import QRCode from 'qrcode';
import { getAuthDatabase, type D1DatabaseLike, type InviteMode, type SessionPolicy } from '../auth/storage';
import { createQrToken, hashQrToken } from '../auth/qr-token';
import { sanitizeSitePath } from '../auth/paths';

type InviteStatus = 'active' | 'disabled' | 'expired' | 'used_up';

interface AdminInviteRow {
  consumed_at: number | null;
  created_at: number;
  created_by: string | null;
  disabled_at: number | null;
  disabled_reason: string | null;
  expires_at: number;
  id: string;
  max_uses: number | null;
  mode: string;
  next_path: string;
  note: string | null;
  session_policy: string;
  session_ttl_seconds: number | null;
  updated_at: number;
  used_count: number;
}

export interface AdminInvite {
  createdAt: number;
  createdBy: string | null;
  disabledAt: number | null;
  disabledReason: string | null;
  expiresAt: number;
  id: string;
  maxUses: number | null;
  mode: InviteMode;
  nextPath: string;
  note: string | null;
  sessionPolicy: SessionPolicy;
  sessionTtlSeconds: number | null;
  status: InviteStatus;
  updatedAt: number;
  usedCount: number;
}

export interface CreateAdminInviteInput {
  baseUrl: string;
  maxUses: number | null;
  mode: InviteMode;
  nextPath: string;
  note: string | null;
  sessionPolicy: SessionPolicy;
  sessionTtlMinutes: number;
  ttlMinutes: number;
}

export interface CreateAdminInviteResult {
  invite: AdminInvite;
  qrSvg: string;
  token: string;
  unlockUrl: string;
}

export interface AdminInviteSummary {
  active: number;
  disabled: number;
  expiringSoon: number;
  total: number;
  usedUp: number;
}

function normalizePositiveInt(value: number | null) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  return null;
}

function normalizeInviteMode(mode: string): InviteMode {
  if (mode === 'limited_uses' || mode === 'reusable_until_expire' || mode === 'single_use') {
    return mode;
  }

  throw new Error(`未知 token 模式: ${mode}`);
}

function normalizeSessionPolicy(value: string): SessionPolicy {
  if (value === 'cap_to_invite_expiry' || value === 'fixed_ttl') {
    return value;
  }

  throw new Error(`未知 session 策略: ${value}`);
}

function isSingleUseConsumed(row: Pick<AdminInviteRow, 'consumed_at' | 'mode' | 'used_count'>) {
  return row.mode === 'single_use' && ((row.used_count ?? 0) > 0 || row.consumed_at !== null);
}

function hasRemainingUses(row: Pick<AdminInviteRow, 'max_uses' | 'mode' | 'used_count'>) {
  if (row.mode !== 'limited_uses') {
    return true;
  }

  const maxUses = normalizePositiveInt(row.max_uses);
  if (!maxUses) {
    return false;
  }

  return (row.used_count ?? 0) < maxUses;
}

function resolveInviteStatus(row: AdminInviteRow, now: number): InviteStatus {
  if (row.disabled_at) {
    return 'disabled';
  }

  if (row.expires_at <= now) {
    return 'expired';
  }

  if (row.mode === 'single_use' && (row.used_count > 0 || row.consumed_at)) {
    return 'used_up';
  }

  if (row.mode === 'limited_uses' && row.max_uses && row.used_count >= row.max_uses) {
    return 'used_up';
  }

  return 'active';
}

function mapInvite(row: AdminInviteRow, now: number): AdminInvite {
  return {
    createdAt: row.created_at,
    createdBy: row.created_by,
    disabledAt: row.disabled_at,
    disabledReason: row.disabled_reason,
    expiresAt: row.expires_at,
    id: row.id,
    maxUses: normalizePositiveInt(row.max_uses),
    mode: normalizeInviteMode(row.mode),
    nextPath: row.next_path,
    note: row.note,
    sessionPolicy: normalizeSessionPolicy(row.session_policy),
    sessionTtlSeconds: normalizePositiveInt(row.session_ttl_seconds),
    status: resolveInviteStatus(row, now),
    updatedAt: row.updated_at,
    usedCount: normalizePositiveInt(row.used_count) ?? 0,
  };
}

function normalizeNote(input: string | null | undefined) {
  const value = input?.trim();
  return value ? value.slice(0, 200) : null;
}

function normalizeMaxUses(mode: InviteMode, value: number | null | undefined) {
  if (mode !== 'limited_uses') {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  throw new Error('limited_uses 模式必须提供大于 0 的 maxUses。');
}

function normalizeMinutes(value: number, field: string) {
  if (Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  throw new Error(`${field} 必须是大于 0 的整数分钟数。`);
}

function buildUnlockUrl(baseUrl: string, nextPath: string, token: string) {
  const url = new URL('/unlock', baseUrl);
  url.searchParams.set('next', nextPath);
  url.hash = new URLSearchParams({ t: token }).toString();
  return url.toString();
}

async function buildQrSvg(unlockUrl: string) {
  return QRCode.toString(unlockUrl, {
    margin: 1,
    type: 'svg',
    width: 512,
  });
}

function summarizeInvites(invites: AdminInvite[], now: number): AdminInviteSummary {
  return invites.reduce<AdminInviteSummary>(
    (summary, invite) => {
      summary.total += 1;

      if (invite.status === 'active') {
        summary.active += 1;
      }

      if (invite.status === 'disabled') {
        summary.disabled += 1;
      }

      if (invite.status === 'used_up') {
        summary.usedUp += 1;
      }

      if (invite.status === 'active' && invite.expiresAt - now <= 60 * 60 * 24 * 3) {
        summary.expiringSoon += 1;
      }

      return summary;
    },
    {
      active: 0,
      disabled: 0,
      expiringSoon: 0,
      total: 0,
      usedUp: 0,
    },
  );
}

export function getAdminDatabase(binding: unknown) {
  return getAuthDatabase(binding);
}

export async function listAdminInvites(db: D1DatabaseLike, now: number) {
  const result = await db
    .prepare(
      `
        select
          id,
          next_path,
          note,
          mode,
          max_uses,
          used_count,
          expires_at,
          consumed_at,
          session_policy,
          session_ttl_seconds,
          disabled_at,
          disabled_reason,
          created_at,
          created_by,
          updated_at
        from invite_tokens
        order by created_at desc
      `,
    )
    .all<AdminInviteRow>();

  const invites = result.results.map((row) => mapInvite(row, now));

  return {
    invites,
    summary: summarizeInvites(invites, now),
  };
}

export async function createAdminInvite(
  db: D1DatabaseLike,
  input: CreateAdminInviteInput,
  actorEmail: string,
  now: number,
): Promise<CreateAdminInviteResult> {
  const mode = normalizeInviteMode(input.mode);
  const ttlMinutes = normalizeMinutes(input.ttlMinutes, 'ttlMinutes');
  const sessionTtlMinutes = normalizeMinutes(input.sessionTtlMinutes, 'sessionTtlMinutes');
  const maxUses = normalizeMaxUses(mode, input.maxUses);
  const nextPath = sanitizeSitePath(input.nextPath, input.baseUrl);
  const token = createQrToken();
  const tokenHash = await hashQrToken(token);
  const inviteId = crypto.randomUUID();
  const expiresAt = now + ttlMinutes * 60;
  const updatedAt = now;

  await db
    .prepare(
      `
        insert into invite_tokens (
          id,
          token_hash,
          next_path,
          note,
          mode,
          max_uses,
          used_count,
          expires_at,
          consumed_at,
          session_policy,
          session_ttl_seconds,
          disabled_at,
          disabled_reason,
          created_at,
          created_by,
          updated_at
        )
        values (?, ?, ?, ?, ?, ?, 0, ?, null, ?, ?, null, null, ?, ?, ?)
      `,
    )
    .bind(
      inviteId,
      tokenHash,
      nextPath,
      normalizeNote(input.note),
      mode,
      maxUses,
      expiresAt,
      input.sessionPolicy,
      sessionTtlMinutes * 60,
      now,
      actorEmail,
      updatedAt,
    )
    .run();

  const unlockUrl = buildUnlockUrl(input.baseUrl, nextPath, token);
  const qrSvg = await buildQrSvg(unlockUrl);
  const { invites } = await listAdminInvites(db, now);
  const invite = invites.find((item: AdminInvite) => item.id === inviteId);

  if (!invite) {
    throw new Error('创建 token 后未能读取记录。');
  }

  return {
    invite,
    qrSvg,
    token,
    unlockUrl,
  };
}

export async function disableAdminInvite(
  db: D1DatabaseLike,
  inviteId: string,
  reason: string | null,
  now: number,
) {
  const result = await db
    .prepare(
      `
        update invite_tokens
        set
          disabled_at = coalesce(disabled_at, ?),
          disabled_reason = ?,
          updated_at = ?
        where id = ?
          and disabled_at is null
      `,
    )
    .bind(now, normalizeNote(reason), now, inviteId)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

export async function extendAdminInvite(
  db: D1DatabaseLike,
  inviteId: string,
  extendMinutes: number,
  now: number,
) {
  const minutes = normalizeMinutes(extendMinutes, 'extendMinutes');
  const row = await db
    .prepare(
      `
        select id, expires_at, mode, used_count, consumed_at
        from invite_tokens
        where id = ?
      `,
    )
    .bind(inviteId)
    .first<{
      consumed_at: number | null;
      expires_at: number;
      id: string;
      mode: string;
      used_count: number;
    }>();

  if (!row) {
    return false;
  }

  if (isSingleUseConsumed(row)) {
    throw new Error('一次性且已使用的 token 不允许延长有效期。');
  }

  const nextExpiresAt = Math.max(row.expires_at, now) + minutes * 60;
  const result = await db
    .prepare(
      `
        update invite_tokens
        set
          expires_at = ?,
          updated_at = ?
        where id = ?
      `,
    )
    .bind(nextExpiresAt, now, inviteId)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

export async function addAdminInviteUses(
  db: D1DatabaseLike,
  inviteId: string,
  additionalUses: number,
  now: number,
) {
  const uses = normalizeMinutes(additionalUses, 'additionalUses');
  const row = await db
    .prepare(
      `
        select id, mode, max_uses
        from invite_tokens
        where id = ?
      `,
    )
    .bind(inviteId)
    .first<{ id: string; max_uses: number | null; mode: string }>();

  if (!row) {
    return false;
  }

  if (row.mode !== 'limited_uses') {
    throw new Error('只有次数限制模式的 token 才允许增加可用次数。');
  }

  const currentMaxUses = normalizePositiveInt(row.max_uses);
  if (!currentMaxUses) {
    throw new Error('当前 token 缺少可用次数配置。');
  }

  const result = await db
    .prepare(
      `
        update invite_tokens
        set
          max_uses = ?,
          updated_at = ?
        where id = ?
      `,
    )
    .bind(currentMaxUses + uses, now, inviteId)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

export async function enableAdminInvite(db: D1DatabaseLike, inviteId: string, now: number) {
  const row = await db
    .prepare(
      `
        select
          id,
          mode,
          max_uses,
          used_count,
          consumed_at,
          expires_at,
          disabled_at
        from invite_tokens
        where id = ?
      `,
    )
    .bind(inviteId)
    .first<{
      consumed_at: number | null;
      disabled_at: number | null;
      expires_at: number;
      id: string;
      max_uses: number | null;
      mode: string;
      used_count: number;
    }>();

  if (!row) {
    return false;
  }

  if (!row.disabled_at) {
    throw new Error('当前 token 未处于禁用状态。');
  }

  if (row.expires_at <= now) {
    throw new Error('已过期 token 不能直接启用，请先延长有效期。');
  }

  if (isSingleUseConsumed(row)) {
    throw new Error('一次性且已使用的 token 不允许重新启用。');
  }

  if (!hasRemainingUses(row)) {
    throw new Error('次数已用尽的 token 不能直接启用，请先增加次数。');
  }

  const result = await db
    .prepare(
      `
        update invite_tokens
        set
          disabled_at = null,
          disabled_reason = null,
          updated_at = ?
        where id = ?
          and disabled_at is not null
      `,
    )
    .bind(now, inviteId)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

export async function readAdminInvite(db: D1DatabaseLike, inviteId: string, now: number) {
  const row = await db
    .prepare(
      `
        select
          id,
          next_path,
          note,
          mode,
          max_uses,
          used_count,
          expires_at,
          consumed_at,
          session_policy,
          session_ttl_seconds,
          disabled_at,
          disabled_reason,
          created_at,
          created_by,
          updated_at
        from invite_tokens
        where id = ?
      `,
    )
    .bind(inviteId)
    .first<AdminInviteRow>();

  return row ? mapInvite(row, now) : null;
}
