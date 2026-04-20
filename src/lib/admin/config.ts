import { normalizeAuthPath } from '../auth/config';

export const DEFAULT_ADMIN_BASE_PATH = '/internal-console/8d98fa5f0df14cabae1ddf37cb6ef4f5';

export interface AdminRuntimeEnv {
  ADMIN_ACCESS_AUD?: string;
  ADMIN_ACCESS_DOMAIN?: string;
  ADMIN_BASE_PATH?: string;
  ADMIN_BYPASS_ACCESS?: string;
  ADMIN_BYPASS_USER_EMAIL?: string;
}

export interface AdminConfig {
  accessAud?: string;
  accessDomain?: `https://${string}.cloudflareaccess.com`;
  basePath: string;
  bypassAccess: boolean;
  bypassUserEmail: string;
}

function normalizeAdminBasePath(input: string | undefined) {
  const normalized = normalizeAuthPath(input?.trim() || DEFAULT_ADMIN_BASE_PATH);
  return normalized === '/' ? DEFAULT_ADMIN_BASE_PATH : normalized;
}

function parseBoolean(value: string | undefined) {
  if (!value) {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function getAdminConfig(env: AdminRuntimeEnv): AdminConfig {
  const domain = env.ADMIN_ACCESS_DOMAIN?.trim();
  const accessDomain =
    domain && domain.startsWith('https://') ? (domain as `https://${string}.cloudflareaccess.com`) : undefined;

  return {
    accessAud: env.ADMIN_ACCESS_AUD?.trim() || undefined,
    accessDomain,
    basePath: normalizeAdminBasePath(env.ADMIN_BASE_PATH),
    bypassAccess: parseBoolean(env.ADMIN_BYPASS_ACCESS),
    bypassUserEmail: env.ADMIN_BYPASS_USER_EMAIL?.trim() || 'local-admin@example.com',
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
