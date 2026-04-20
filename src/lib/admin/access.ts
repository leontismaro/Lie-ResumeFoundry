import cloudflareAccessPlugin from '@cloudflare/pages-plugin-cloudflare-access';
import type { PluginData } from '@cloudflare/pages-plugin-cloudflare-access';
import type { AdminConfig } from './config';

export interface AdminIdentity {
  email: string;
}

interface AdminAccessContext {
  data: Record<string, unknown>;
  env: Record<string, unknown>;
  functionPath: string;
  next: (input?: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  passThroughOnException: () => void;
  request: Request;
  waitUntil: (promise: Promise<unknown>) => void;
}

export type AdminAccessResult =
  | {
      identity: AdminIdentity;
      ok: true;
    }
  | {
      ok: false;
      response: Response;
    };

function buildConfigErrorResponse(message: string) {
  return new Response(message, {
    status: 500,
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Robots-Tag': 'noindex, noarchive, nosnippet',
    },
  });
}

export async function requireAdminAccess(
  context: AdminAccessContext,
  config: AdminConfig,
): Promise<AdminAccessResult> {
  if (config.bypassAccess) {
    return {
      identity: {
        email: config.bypassUserEmail,
      },
      ok: true,
    };
  }

  if (!config.accessDomain || !config.accessAud) {
    return {
      ok: false,
      response: buildConfigErrorResponse('缺少 ADMIN_ACCESS_DOMAIN 或 ADMIN_ACCESS_AUD，无法校验后台访问权限。'),
    };
  }

  const accessData: Record<string, unknown> = {};
  const validator = cloudflareAccessPlugin({
    aud: config.accessAud,
    domain: config.accessDomain,
  });

  const response = await validator({
    data: accessData,
    env: context.env,
    functionPath: context.functionPath,
    next: async () => new Response(null, { status: 204 }),
    passThroughOnException: context.passThroughOnException,
    request: context.request,
    waitUntil: context.waitUntil,
  });

  if (response.status !== 204) {
    return {
      ok: false,
      response,
    };
  }

  const payload = (accessData as PluginData).cloudflareAccess?.JWT.payload;
  const email = payload?.email?.trim();

  return {
    identity: {
      email: email || 'service-user',
    },
    ok: true,
  };
}
