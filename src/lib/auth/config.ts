export const DEFAULT_COOKIE_NAME = 'resume_session';
export const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
export const DEFAULT_QR_TOKEN_TTL_SECONDS = 60 * 15;
export const DEFAULT_QR_RATE_LIMIT_MAX_ATTEMPTS = 8;
export const DEFAULT_QR_RATE_LIMIT_WINDOW_SECONDS = 60 * 10;
export const DEFAULT_PUBLIC_PATHS = ['/unlock', '/auth/qr', '/auth/logout', '/favicon.ico', '/favicon.svg'];
export const DEFAULT_PUBLIC_PATH_PREFIXES = ['/_astro'];
export const UNLOCK_PATH = '/unlock';
export const QR_AUTH_PATH = '/auth/qr';
export const LOGOUT_PATH = '/auth/logout';

export interface AuthRuntimeEnv {
  AUTH_COOKIE_NAME?: string;
  AUTH_SESSION_TTL_SECONDS?: string | number;
  AUTH_QR_DEFAULT_TTL_SECONDS?: string | number;
  AUTH_QR_RATE_LIMIT_MAX_ATTEMPTS?: string | number;
  AUTH_QR_RATE_LIMIT_WINDOW_SECONDS?: string | number;
  AUTH_PUBLIC_PATHS?: string;
  AUTH_COOKIE_DOMAIN?: string;
  AUTH_DB?: unknown;
}

export interface AuthConfig {
  cookieDomain?: string;
  cookieName: string;
  publicPaths: Set<string>;
  publicPathPrefixes: Set<string>;
  qrRateLimitMaxAttempts: number;
  qrRateLimitWindowSeconds: number;
  qrTokenTtlSeconds: number;
  sessionTtlSeconds: number;
}

export function normalizeAuthPath(input: string) {
  const trimmed = input.trim();
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  let normalized = withLeadingSlash.replace(/\/{2,}/g, '/');

  if (normalized.endsWith('/index.html')) {
    normalized = normalized.slice(0, -'/index.html'.length) || '/';
  }

  if (normalized !== '/') {
    normalized = normalized.replace(/\/+$/g, '') || '/';
  }

  return normalized || '/';
}

export function isPublicPath(publicPaths: Set<string>, publicPathPrefixes: Set<string>, input: string) {
  const normalized = normalizeAuthPath(input);

  if (publicPaths.has(normalized)) {
    return true;
  }

  for (const value of publicPathPrefixes) {
    if (value !== '/' && normalized.startsWith(`${value}/`)) {
      return true;
    }
  }

  return false;
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

function parsePublicPaths(value: string | undefined) {
  if (!value) {
    return new Set(DEFAULT_PUBLIC_PATHS.map((path) => normalizeAuthPath(path)));
  }

  const paths = value
    .split(',')
    .map((part) => normalizeAuthPath(part))
    .filter(Boolean);

  return new Set(paths.length > 0 ? paths : DEFAULT_PUBLIC_PATHS.map((path) => normalizeAuthPath(path)));
}

function parsePublicPathPrefixes(value: string | undefined) {
  if (!value) {
    return new Set(DEFAULT_PUBLIC_PATH_PREFIXES.map((path) => normalizeAuthPath(path)));
  }

  const prefixes = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.endsWith('/*'))
    .map((part) => normalizeAuthPath(part.slice(0, -2)))
    .filter(Boolean);

  return new Set(
    prefixes.length > 0 ? prefixes : DEFAULT_PUBLIC_PATH_PREFIXES.map((path) => normalizeAuthPath(path)),
  );
}

export function getAuthConfig(env: AuthRuntimeEnv): AuthConfig {
  return {
    cookieDomain: env.AUTH_COOKIE_DOMAIN?.trim() || undefined,
    cookieName: env.AUTH_COOKIE_NAME?.trim() || DEFAULT_COOKIE_NAME,
    publicPaths: parsePublicPaths(env.AUTH_PUBLIC_PATHS),
    publicPathPrefixes: parsePublicPathPrefixes(env.AUTH_PUBLIC_PATHS),
    qrRateLimitMaxAttempts: parsePositiveInt(
      env.AUTH_QR_RATE_LIMIT_MAX_ATTEMPTS,
      DEFAULT_QR_RATE_LIMIT_MAX_ATTEMPTS,
    ),
    qrRateLimitWindowSeconds: parsePositiveInt(
      env.AUTH_QR_RATE_LIMIT_WINDOW_SECONDS,
      DEFAULT_QR_RATE_LIMIT_WINDOW_SECONDS,
    ),
    qrTokenTtlSeconds: parsePositiveInt(env.AUTH_QR_DEFAULT_TTL_SECONDS, DEFAULT_QR_TOKEN_TTL_SECONDS),
    sessionTtlSeconds: parsePositiveInt(env.AUTH_SESSION_TTL_SECONDS, DEFAULT_SESSION_TTL_SECONDS),
  };
}
