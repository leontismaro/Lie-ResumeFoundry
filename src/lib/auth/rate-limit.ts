import type { D1DatabaseLike } from './storage';

const QR_AUTH_RATE_LIMIT_SCOPE = 'auth_qr_ip';

interface RateLimitRow {
  attempts: number;
  blocked_until: number | null;
  subject: string;
  updated_at: number;
  window_started_at: number;
}

export interface RateLimitConfig {
  maxAttempts: number;
  windowSeconds: number;
}

export interface RateLimitState {
  blocked: boolean;
  retryAfterSeconds: number;
}

export type QrAuthRateLimitConfig = RateLimitConfig;
export type QrAuthRateLimitState = RateLimitState;

function normalizeSubject(input: string | null | undefined) {
  const value = input?.trim();
  return value ? value.slice(0, 255) : 'unknown';
}

function readClientAddressFromXForwardedFor(value: string | null) {
  if (!value) {
    return null;
  }

  const [first] = value.split(',');
  return first?.trim() || null;
}

export function getClientAddress(request: Request) {
  return normalizeSubject(
    request.headers.get('CF-Connecting-IP') ||
      readClientAddressFromXForwardedFor(request.headers.get('X-Forwarded-For')) ||
      request.headers.get('X-Real-IP'),
  );
}

async function readRateLimitRow(db: D1DatabaseLike, scope: string, subject: string) {
  return db
    .prepare(
      `
        select
          subject,
          attempts,
          window_started_at,
          blocked_until,
          updated_at
        from auth_rate_limits
        where scope = ?
          and subject = ?
      `,
    )
    .bind(scope, subject)
    .first<RateLimitRow>();
}

export async function readRateLimitState(
  db: D1DatabaseLike,
  scope: string,
  subject: string,
  now: number,
): Promise<RateLimitState> {
  const row = await readRateLimitRow(db, scope, normalizeSubject(subject));

  if (!row || !row.blocked_until || row.blocked_until <= now) {
    return {
      blocked: false,
      retryAfterSeconds: 0,
    };
  }

  return {
    blocked: true,
    retryAfterSeconds: Math.max(1, row.blocked_until - now),
  };
}

export async function clearRateLimit(db: D1DatabaseLike, scope: string, subject: string) {
  await db
    .prepare(
      `
        delete from auth_rate_limits
        where scope = ?
          and subject = ?
      `,
    )
    .bind(scope, normalizeSubject(subject))
    .run();
}

export async function recordFailedRateLimitAttempt(
  db: D1DatabaseLike,
  scope: string,
  subject: string,
  now: number,
  config: RateLimitConfig,
): Promise<RateLimitState> {
  const normalizedSubject = normalizeSubject(subject);
  const row = await readRateLimitRow(db, scope, normalizedSubject);
  const shouldResetWindow =
    !row ||
    now - row.window_started_at >= config.windowSeconds ||
    (row.blocked_until !== null && row.blocked_until <= now);

  if (shouldResetWindow) {
    const blockedUntil = config.maxAttempts <= 1 ? now + config.windowSeconds : null;

    await db
      .prepare(
        `
          insert into auth_rate_limits (
            scope,
            subject,
            attempts,
            window_started_at,
            blocked_until,
            updated_at
          )
          values (?, ?, 1, ?, ?, ?)
          on conflict(scope, subject) do update set
            attempts = excluded.attempts,
            window_started_at = excluded.window_started_at,
            blocked_until = excluded.blocked_until,
            updated_at = excluded.updated_at
        `,
      )
      .bind(scope, normalizedSubject, now, blockedUntil, now)
      .run();

    return {
      blocked: blockedUntil !== null,
      retryAfterSeconds: blockedUntil ? config.windowSeconds : 0,
    };
  }

  if (row.blocked_until && row.blocked_until > now) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, row.blocked_until - now),
    };
  }

  const nextAttempts = row.attempts + 1;
  const blockedUntil = nextAttempts >= config.maxAttempts ? now + config.windowSeconds : null;

  await db
    .prepare(
      `
        update auth_rate_limits
        set
          attempts = ?,
          blocked_until = ?,
          updated_at = ?
        where scope = ?
          and subject = ?
      `,
    )
    .bind(nextAttempts, blockedUntil, now, scope, normalizedSubject)
    .run();

  return {
    blocked: blockedUntil !== null,
    retryAfterSeconds: blockedUntil ? config.windowSeconds : 0,
  };
}

export async function readQrAuthRateLimitState(
  db: D1DatabaseLike,
  subject: string,
  now: number,
): Promise<QrAuthRateLimitState> {
  return readRateLimitState(db, QR_AUTH_RATE_LIMIT_SCOPE, subject, now);
}

export async function clearQrAuthRateLimit(db: D1DatabaseLike, subject: string) {
  await clearRateLimit(db, QR_AUTH_RATE_LIMIT_SCOPE, subject);
}

export async function recordFailedQrAuthAttempt(
  db: D1DatabaseLike,
  subject: string,
  now: number,
  config: QrAuthRateLimitConfig,
): Promise<QrAuthRateLimitState> {
  return recordFailedRateLimitAttempt(db, QR_AUTH_RATE_LIMIT_SCOPE, subject, now, config);
}
