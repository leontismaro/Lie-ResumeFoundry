import { createSessionId } from './session';

export interface D1RunResult {
  meta?: {
    changes?: number;
  };
}

export interface D1FirstResult<T> {
  first<TValue = T>(): Promise<TValue | null>;
  all<TValue = T>(): Promise<{ results: TValue[] }>;
  run(): Promise<D1RunResult>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1FirstResult<unknown>;
  all<TValue = unknown>(): Promise<{ results: TValue[] }>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatement;
}

export type InviteMode = 'single_use' | 'reusable_until_expire' | 'limited_uses';
export type SessionPolicy = 'fixed_ttl' | 'cap_to_invite_expiry';
export type InviteAuthorizationError =
  | 'not_found'
  | 'expired'
  | 'already_used'
  | 'disabled'
  | 'usage_limit_reached'
  | 'invalid_configuration';

interface InviteTokenRow {
  id: string;
  consumed_at: number | null;
  disabled_at: number | null;
  expires_at: number;
  max_uses: number | null;
  mode: string;
  next_path: string;
  session_policy: string | null;
  session_ttl_seconds: number | null;
  used_count: number | null;
}

export interface InviteAuthorization {
  expiresAt: number;
  inviteId: string;
  mode: InviteMode;
  nextPath: string;
  sessionPolicy: SessionPolicy;
  sessionTtlSeconds: number | null;
}

interface StoredInviteToken extends InviteAuthorization {
  consumedAt: number | null;
  disabledAt: number | null;
  maxUses: number | null;
  usedCount: number;
}

interface SessionRow {
  expires_at: number;
  id: string;
  invite_id: string;
}

export interface ActiveSession {
  expiresAt: number;
  id: string;
  inviteId: string;
}

export type InviteAuthorizationResult =
  | {
      invite: InviteAuthorization;
      ok: true;
    }
  | {
      error: InviteAuthorizationError;
      ok: false;
    };

type ReadInviteTokenResult =
  | {
      invite: StoredInviteToken;
      ok: true;
    }
  | {
      error: InviteAuthorizationError;
      ok: false;
    };

export function getAuthDatabase(binding: unknown) {
  if (!binding || typeof binding !== 'object' || !('prepare' in binding)) {
    throw new Error('缺少 AUTH_DB 绑定，无法校验访问短码。');
  }

  return binding as D1DatabaseLike;
}

function normalizeInviteMode(mode: string): InviteMode | null {
  if (mode === 'single_use' || mode === 'reusable_until_expire' || mode === 'limited_uses') {
    return mode;
  }

  return null;
}

function normalizeSessionPolicy(value: string | null): SessionPolicy {
  return value === 'cap_to_invite_expiry' ? 'cap_to_invite_expiry' : 'fixed_ttl';
}

function normalizePositiveInt(value: number | null) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  return null;
}

async function readInviteToken(
  db: D1DatabaseLike,
  tokenHash: string,
  now: number,
): Promise<ReadInviteTokenResult> {
  const row = await db
    .prepare(
      `
        select
          id,
          next_path,
          mode,
          max_uses,
          expires_at,
          consumed_at,
          disabled_at,
          used_count,
          session_policy,
          session_ttl_seconds
        from invite_tokens
        where token_hash = ?
      `,
    )
    .bind(tokenHash)
    .first<InviteTokenRow>();

  if (!row) {
    return {
      error: 'not_found' as const,
      ok: false as const,
    };
  }

  const mode = normalizeInviteMode(row.mode);
  if (!mode) {
    return {
      error: 'invalid_configuration' as const,
      ok: false as const,
    };
  }

  if (row.expires_at <= now) {
    return {
      error: 'expired' as const,
      ok: false as const,
    };
  }

  if (row.disabled_at) {
    return {
      error: 'disabled' as const,
      ok: false as const,
    };
  }

  const invite: StoredInviteToken = {
    consumedAt: row.consumed_at,
    disabledAt: row.disabled_at,
    expiresAt: row.expires_at,
    inviteId: row.id,
    maxUses: normalizePositiveInt(row.max_uses),
    mode,
    nextPath: row.next_path,
    sessionPolicy: normalizeSessionPolicy(row.session_policy),
    sessionTtlSeconds: normalizePositiveInt(row.session_ttl_seconds),
    usedCount: normalizePositiveInt(row.used_count) ?? 0,
  };

  return {
    invite,
    ok: true as const,
  };
}

async function markSingleUseInvite(db: D1DatabaseLike, tokenHash: string, now: number) {
  const result = await db
    .prepare(
      `
        update invite_tokens
        set
          used_count = used_count + 1,
          consumed_at = coalesce(consumed_at, ?)
        where token_hash = ?
          and expires_at > ?
          and used_count = 0
      `,
    )
    .bind(now, tokenHash, now)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

async function incrementLimitedInvite(db: D1DatabaseLike, tokenHash: string, now: number, maxUses: number) {
  const result = await db
    .prepare(
      `
        update invite_tokens
        set
          used_count = used_count + 1,
          consumed_at = coalesce(consumed_at, ?)
        where token_hash = ?
          and expires_at > ?
          and used_count < ?
      `,
    )
    .bind(now, tokenHash, now, maxUses)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

async function markReusableInvite(db: D1DatabaseLike, tokenHash: string, now: number) {
  await db
    .prepare(
      `
        update invite_tokens
        set
          used_count = used_count + 1,
          consumed_at = coalesce(consumed_at, ?),
          updated_at = ?
        where token_hash = ?
          and expires_at > ?
          and disabled_at is null
      `,
    )
    .bind(now, now, tokenHash, now)
    .run();
}

export async function authorizeInviteToken(
  db: D1DatabaseLike,
  tokenHash: string,
  now: number,
): Promise<InviteAuthorizationResult> {
  const result = await readInviteToken(db, tokenHash, now);

  if (!result.ok) {
    return result;
  }

  const invite = result.invite;

  if (invite.mode === 'single_use') {
    if (invite.usedCount > 0 || invite.consumedAt) {
      return {
        error: 'already_used',
        ok: false,
      };
    }

    const granted = await markSingleUseInvite(db, tokenHash, now);
    if (!granted) {
      return {
        error: 'already_used',
        ok: false,
      };
    }
  }

  if (invite.mode === 'limited_uses') {
    if (!invite.maxUses) {
      return {
        error: 'invalid_configuration',
        ok: false,
      };
    }

    if (invite.usedCount >= invite.maxUses) {
      return {
        error: 'usage_limit_reached',
        ok: false,
      };
    }

    const granted = await incrementLimitedInvite(db, tokenHash, now, invite.maxUses);
    if (!granted) {
      return {
        error: 'usage_limit_reached',
        ok: false,
      };
    }
  }

  if (invite.mode === 'reusable_until_expire') {
    await markReusableInvite(db, tokenHash, now);
  }

  return {
    invite: {
      expiresAt: invite.expiresAt,
      inviteId: invite.inviteId,
      mode: invite.mode,
      nextPath: invite.nextPath,
      sessionPolicy: invite.sessionPolicy,
      sessionTtlSeconds: invite.sessionTtlSeconds,
    },
    ok: true,
  };
}

export async function createActiveSession(
  db: D1DatabaseLike,
  inviteId: string,
  expiresAt: number,
  now: number,
) {
  const sessionId = createSessionId();

  await db
    .prepare(
      `
        insert into sessions (
          id,
          invite_id,
          expires_at,
          revoked_at,
          created_at
        )
        values (?, ?, ?, null, ?)
      `,
    )
    .bind(sessionId, inviteId, expiresAt, now)
    .run();

  return {
    expiresAt,
    id: sessionId,
    inviteId,
  } satisfies ActiveSession;
}

export async function readActiveSession(db: D1DatabaseLike, sessionId: string, now: number) {
  const row = await db
    .prepare(
      `
        select
          id,
          invite_id,
          expires_at
        from sessions
        where id = ?
          and revoked_at is null
          and expires_at > ?
      `,
    )
    .bind(sessionId, now)
    .first<SessionRow>();

  if (!row) {
    return null;
  }

  return {
    expiresAt: row.expires_at,
    id: row.id,
    inviteId: row.invite_id,
  } satisfies ActiveSession;
}

export async function revokeSession(db: D1DatabaseLike, sessionId: string, now: number) {
  await db
    .prepare(
      `
        update sessions
        set revoked_at = coalesce(revoked_at, ?)
        where id = ?
      `,
    )
    .bind(now, sessionId)
    .run();
}

export async function revokeSessionsByInviteId(db: D1DatabaseLike, inviteId: string, now: number) {
  await db
    .prepare(
      `
        update sessions
        set revoked_at = coalesce(revoked_at, ?)
        where invite_id = ?
      `,
    )
    .bind(now, inviteId)
    .run();
}
