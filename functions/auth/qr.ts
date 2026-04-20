import { serializeCookie } from '../../src/lib/auth/cookies';
import { getAuthConfig } from '../../src/lib/auth/config';
import { sanitizeSitePath } from '../../src/lib/auth/paths';
import {
  clearQrAuthRateLimit,
  getClientAddress,
  readQrAuthRateLimitState,
  recordFailedQrAuthAttempt,
} from '../../src/lib/auth/rate-limit';
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

function buildRateLimitedResponse(origin: string, next: string, retryAfterSeconds: number) {
  return buildRedirectResponse(buildUnlockLocation(origin, next, 'too-many-attempts'), {
    'Retry-After': String(retryAfterSeconds),
  });
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

async function safeReadQrAuthRateLimitState(
  db: ReturnType<typeof getAuthDatabase>,
  subject: string,
  now: number,
) {
  try {
    return await readQrAuthRateLimitState(db, subject, now);
  } catch (error) {
    console.error('读取二维码验证限流状态失败，已降级为放行。', error);
    return {
      blocked: false,
      retryAfterSeconds: 0,
    };
  }
}

async function safeRecordFailedQrAuthAttempt(
  db: ReturnType<typeof getAuthDatabase>,
  subject: string,
  now: number,
  config: {
    maxAttempts: number;
    windowSeconds: number;
  },
) {
  try {
    return await recordFailedQrAuthAttempt(db, subject, now, config);
  } catch (error) {
    console.error('记录二维码验证失败次数时出错，已降级为不拦截。', error);
    return {
      blocked: false,
      retryAfterSeconds: 0,
    };
  }
}

async function safeClearQrAuthRateLimit(db: ReturnType<typeof getAuthDatabase>, subject: string) {
  try {
    await clearQrAuthRateLimit(db, subject);
  } catch (error) {
    console.error('清理二维码验证限流状态失败，已忽略。', error);
  }
}

export async function onRequest(context: PagesContext) {
  const requestUrl = new URL(context.request.url);
  const config = getAuthConfig(context.env);
  const db = getAuthDatabase(context.env.AUTH_DB);
  const clientAddress = getClientAddress(context.request);
  let nextPath = sanitizeSitePath(requestUrl.searchParams.get('next'), requestUrl.origin);
  let token: string | null = null;
  let hasSubmittedToken = false;

  if (context.request.method === 'POST') {
    const formData = await context.request.formData();
    nextPath = sanitizeSitePath(readStringFormValue(formData, 'next'), requestUrl.origin);
    const rawToken = readStringFormValue(formData, 'token');
    hasSubmittedToken = Boolean(rawToken?.trim());
    token = normalizeQrToken(rawToken);
  }

  if (!token) {
    const rateLimit = await safeRecordFailedQrAuthAttempt(db, clientAddress, Math.floor(Date.now() / 1000), {
      maxAttempts: config.qrRateLimitMaxAttempts,
      windowSeconds: config.qrRateLimitWindowSeconds,
    });

    if (rateLimit.blocked) {
      return buildRateLimitedResponse(requestUrl.origin, nextPath, rateLimit.retryAfterSeconds);
    }

    return buildRedirectResponse(
      buildUnlockLocation(requestUrl.origin, nextPath, hasSubmittedToken ? 'invalid-token' : 'missing-token'),
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const currentRateLimit = await safeReadQrAuthRateLimitState(db, clientAddress, now);
  if (currentRateLimit.blocked) {
    return buildRateLimitedResponse(requestUrl.origin, nextPath, currentRateLimit.retryAfterSeconds);
  }

  const tokenHash = await hashQrToken(token);
  const invite = await authorizeInviteToken(db, tokenHash, now);

  if (!invite.ok) {
    const rateLimit = await safeRecordFailedQrAuthAttempt(db, clientAddress, now, {
      maxAttempts: config.qrRateLimitMaxAttempts,
      windowSeconds: config.qrRateLimitWindowSeconds,
    });

    if (rateLimit.blocked) {
      return buildRateLimitedResponse(requestUrl.origin, nextPath, rateLimit.retryAfterSeconds);
    }

    return buildRedirectResponse(
      buildUnlockLocation(requestUrl.origin, nextPath, mapAuthorizationError(invite.error)),
    );
  }

  await safeClearQrAuthRateLimit(db, clientAddress);
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
