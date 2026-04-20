import { clearCookie, getCookie } from '../src/lib/auth/cookies';
import { getAuthConfig, isPublicPath, normalizeAuthPath, UNLOCK_PATH } from '../src/lib/auth/config';
import { normalizeSessionId } from '../src/lib/auth/session';
import { getAuthDatabase, readActiveSession } from '../src/lib/auth/storage';
import { handleAdminRequest } from '../src/lib/admin/handler';

interface PagesContext {
  data?: Record<string, unknown>;
  env: Record<string, unknown>;
  functionPath?: string;
  next: () => Promise<Response>;
  passThroughOnException?: () => void;
  request: Request;
  waitUntil?: (promise: Promise<unknown>) => void;
}

function buildRedirectResponse(location: string, headers?: HeadersInit) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      ...headers,
    },
  });
}

function buildUnlockLocation(requestUrl: URL) {
  const target = `${normalizeAuthPath(requestUrl.pathname)}${requestUrl.search}`;
  const unlockUrl = new URL(UNLOCK_PATH, requestUrl.origin);
  unlockUrl.searchParams.set('next', target);
  return unlockUrl.toString();
}

function withPrivateHeaders(response: Response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Robots-Tag', 'noindex, noarchive, nosnippet');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function onRequest(context: PagesContext) {
  const requestUrl = new URL(context.request.url);
  const adminResponse = await handleAdminRequest(context);
  if (adminResponse) {
    return withPrivateHeaders(adminResponse);
  }

  const config = getAuthConfig(context.env);

  if (isPublicPath(config.publicPaths, config.publicPathPrefixes, requestUrl.pathname)) {
    return context.next();
  }

  const sessionCookie = getCookie(context.request.headers.get('Cookie'), config.cookieName);
  const sessionId = normalizeSessionId(sessionCookie);
  if (!sessionId) {
    return buildRedirectResponse(buildUnlockLocation(requestUrl));
  }

  const db = getAuthDatabase(context.env.AUTH_DB);
  const now = Math.floor(Date.now() / 1000);
  const session = await readActiveSession(db, sessionId, now);
  if (!session) {
    return buildRedirectResponse(buildUnlockLocation(requestUrl), {
      'Set-Cookie': clearCookie(config.cookieName, {
        domain: config.cookieDomain,
        path: '/',
        sameSite: 'Lax',
        secure: requestUrl.protocol === 'https:',
      }),
    });
  }

  return withPrivateHeaders(await context.next());
}
