import { clearCookie, getCookie } from '../../src/lib/auth/cookies';
import { getAuthConfig, UNLOCK_PATH } from '../../src/lib/auth/config';
import { normalizeSessionId } from '../../src/lib/auth/session';
import { getAuthDatabase, revokeSession } from '../../src/lib/auth/storage';

interface PagesContext {
  env: Record<string, unknown>;
  request: Request;
}

export async function onRequest(context: PagesContext) {
  const requestUrl = new URL(context.request.url);
  const config = getAuthConfig(context.env);
  const unlockUrl = new URL(UNLOCK_PATH, requestUrl.origin);
  unlockUrl.searchParams.set('logged_out', '1');
  const sessionId = normalizeSessionId(getCookie(context.request.headers.get('Cookie'), config.cookieName));

  if (sessionId) {
    const db = getAuthDatabase(context.env.AUTH_DB);
    const now = Math.floor(Date.now() / 1000);
    await revokeSession(db, sessionId, now);
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: unlockUrl.toString(),
      'Cache-Control': 'private, no-store',
      'Set-Cookie': clearCookie(config.cookieName, {
        domain: config.cookieDomain,
        path: '/',
        sameSite: 'Lax',
        secure: requestUrl.protocol === 'https:',
      }),
    },
  });
}
