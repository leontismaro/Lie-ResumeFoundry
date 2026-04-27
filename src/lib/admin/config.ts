import { normalizeAuthPath } from '../auth/config';

export const DEFAULT_ADMIN_BASE_PATH = '/internal-console/8d98fa5f0df14cabae1ddf37cb6ef4f5';
export const DEFAULT_ADMIN_SESSION_COOKIE_NAME = 'resume_admin_session';
export const DEFAULT_ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;
export const DEFAULT_ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const DEFAULT_ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS = 60 * 10;

export type AdminAuthMode = 'access' | 'access_with_local_fallback' | 'local';

export interface AdminRuntimeEnv {
  ADMIN_ACCESS_AUD?: string;
  ADMIN_ACCESS_DOMAIN?: string;
  ADMIN_AUTH_MODE?: string;
  ADMIN_BASE_PATH?: string;
  ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS?: string | number;
  ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS?: string | number;
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_SESSION_COOKIE_NAME?: string;
  ADMIN_SESSION_SECRET?: string;
  ADMIN_SESSION_TTL_SECONDS?: string | number;
  ADMIN_USER_EMAIL?: string;
}

export interface AdminConfig {
  accessAud?: string;
  accessDomain?: `https://${string}.cloudflareaccess.com`;
  authMode: AdminAuthMode;
  basePath: string;
  loginRateLimitMaxAttempts: number;
  loginRateLimitWindowSeconds: number;
  passwordHash?: string;
  sessionCookieName: string;
  sessionSecret?: string;
  sessionTtlSeconds: number;
  userEmail: string;
}

function normalizeAdminBasePath(input: string | undefined) {
  const normalized = normalizeAuthPath(input?.trim() || DEFAULT_ADMIN_BASE_PATH);
  return normalized === '/' ? DEFAULT_ADMIN_BASE_PATH : normalized;
}

function parseAuthMode(value: string | undefined): AdminAuthMode {
  const normalized = value?.trim().toLowerCase();

  if (normalized === 'access' || normalized === 'access_with_local_fallback' || normalized === 'local') {
    return normalized;
  }

  return 'local';
}

function parsePositiveInt(value: string | number | undefined, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeOptionalSecret(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized || normalized.startsWith('replace-with-')) {
    return undefined;
  }

  return normalized;
}

export function getAdminConfig(env: AdminRuntimeEnv): AdminConfig {
  const domain = env.ADMIN_ACCESS_DOMAIN?.trim();
  const accessDomain =
    domain && domain.startsWith('https://') && !domain.includes('replace-with-')
      ? (domain as `https://${string}.cloudflareaccess.com`)
      : undefined;
  const passwordHash = normalizeOptionalSecret(env.ADMIN_PASSWORD_HASH);
  const sessionSecret = normalizeOptionalSecret(env.ADMIN_SESSION_SECRET);

  return {
    accessAud: normalizeOptionalSecret(env.ADMIN_ACCESS_AUD),
    accessDomain,
    authMode: parseAuthMode(env.ADMIN_AUTH_MODE),
    basePath: normalizeAdminBasePath(env.ADMIN_BASE_PATH),
    loginRateLimitMaxAttempts: parsePositiveInt(
      env.ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
      DEFAULT_ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    ),
    loginRateLimitWindowSeconds: parsePositiveInt(
      env.ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
      DEFAULT_ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    ),
    passwordHash,
    sessionCookieName: env.ADMIN_SESSION_COOKIE_NAME?.trim() || DEFAULT_ADMIN_SESSION_COOKIE_NAME,
    sessionSecret,
    sessionTtlSeconds: parsePositiveInt(env.ADMIN_SESSION_TTL_SECONDS, DEFAULT_ADMIN_SESSION_TTL_SECONDS),
    userEmail: env.ADMIN_USER_EMAIL?.trim() || 'admin@example.com',
  };
}

export function isAdminPath(basePath: string, input: string) {
  const normalized = normalizeAuthPath(input);
  return normalized === basePath || normalized.startsWith(`${basePath}/`);
}

export function getAdminSubPath(basePath: string, input: string) {
  const normalized = normalizeAuthPath(input);

  if (normalized === basePath) {
    return '/';
  }

  if (normalized.startsWith(`${basePath}/`)) {
    return normalized.slice(basePath.length) || '/';
  }

  return null;
}
