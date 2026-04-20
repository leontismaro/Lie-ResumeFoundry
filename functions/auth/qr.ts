import { serializeCookie } from '../../src/lib/auth/cookies';
import { getAuthConfig } from '../../src/lib/auth/config';
import { sanitizeSitePath } from '../../src/lib/auth/paths';
import { hashQrToken, normalizeQrToken } from '../../src/lib/auth/qr-token';
import {
  authorizeInviteToken,
  createActiveSession,
  getAuthDatabase,
  type InviteAuthorization,
  type InviteAuthorizationError,
} from '../../src/lib/auth/storage';

interface PagesContext {
  env: Record<string, unknown>;
  request: Request;
}

function buildRedirectResponse(location: string, headers?: HeadersInit) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: location,
      'Cache-Control': 'private, no-store',
      ...headers,
    },
  });
}

function buildUnlockLocation(origin: string, next: string, error: string) {
  const url = new URL('/unlock', origin);
  url.searchParams.set('next', next);
  url.searchParams.set('error', error);
  return url.toString();
}

function mapAuthorizationError(error: InviteAuthorizationError) {
  switch (error) {
    case 'expired':
      return 'expired-token';
    case 'already_used':
      return 'already-used-token';
    case 'disabled':
      return 'disabled-token';
    case 'usage_limit_reached':
      return 'usage-limit-reached';
    case 'invalid_configuration':
      return 'token-config-error';
    case 'not_found':
    default:
      return 'invalid-token';
  }
}

function resolveSessionTtlSeconds(
  invite: InviteAuthorization,
  defaultSessionTtlSeconds: number,
  now: number,
) {
  const baseTtl = invite.sessionTtlSeconds ?? defaultSessionTtlSeconds;

  if (invite.sessionPolicy === 'cap_to_invite_expiry') {
    return Math.max(1, Math.min(baseTtl, invite.expiresAt - now));
  }

  return baseTtl;
}

function readStringFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : null;
}

export async function onRequest(context: PagesContext) {
  const requestUrl = new URL(context.request.url);
  const config = getAuthConfig(context.env);
  const db = getAuthDatabase(context.env.AUTH_DB);
  let nextPath = sanitizeSitePath(requestUrl.searchParams.get('next'), requestUrl.origin);
  let token: string | null = null;

  if (context.request.method === 'POST') {
    const formData = await context.request.formData();
    nextPath = sanitizeSitePath(readStringFormValue(formData, 'next'), requestUrl.origin);
    token = normalizeQrToken(readStringFormValue(formData, 'token'));
  }

  if (!token) {
    return buildRedirectResponse(buildUnlockLocation(requestUrl.origin, nextPath, 'missing-token'));
  }

  const tokenHash = await hashQrToken(token);
  const now = Math.floor(Date.now() / 1000);
  const invite = await authorizeInviteToken(db, tokenHash, now);

  if (!invite.ok) {
    return buildRedirectResponse(
      buildUnlockLocation(requestUrl.origin, nextPath, mapAuthorizationError(invite.error)),
    );
  }

  const sessionTtlSeconds = resolveSessionTtlSeconds(invite.invite, config.sessionTtlSeconds, now);
  const sessionExpiresAt = now + sessionTtlSeconds;
  const session = await createActiveSession(db, invite.invite.inviteId, sessionExpiresAt, now);
  const sessionCookie = serializeCookie(config.cookieName, session.id, {
    domain: config.cookieDomain,
    maxAge: sessionTtlSeconds,
    path: '/',
    sameSite: 'Lax',
    secure: requestUrl.protocol === 'https:',
  });

  return buildRedirectResponse(new URL(invite.invite.nextPath, requestUrl.origin).toString(), {
    'Set-Cookie': sessionCookie,
    'X-Robots-Tag': 'noindex, noarchive, nosnippet',
  });
}
