import { revokeSessionsByInviteId } from '../auth/storage';
import { adminRouteOptions } from '../../generated/admin-route-options';
import { getAdminConfig, getAdminSubPath } from './config';
import { requireAdminAccess } from './access';
import {
  addAdminInviteUses,
  createAdminInvite,
  disableAdminInvite,
  enableAdminInvite,
  extendAdminInvite,
  getAdminDatabase,
  listAdminInvites,
  readAdminInvite,
} from './storage';
import { renderAdminPage } from './page';

interface PagesContext {
  data?: Record<string, unknown>;
  env: Record<string, unknown>;
  functionPath?: string;
  passThroughOnException?: () => void;
  request: Request;
  waitUntil?: (promise: Promise<unknown>) => void;
}

function buildHeaders(extra?: HeadersInit) {
  return {
    'Cache-Control': 'private, no-store',
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-Robots-Tag': 'noindex, noarchive, nosnippet',
    ...extra,
  };
}

function buildJsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: buildHeaders({
      'Content-Type': 'application/json; charset=utf-8',
    }),
  });
}

function buildHtmlResponse(html: string) {
  return new Response(html, {
    status: 200,
    headers: buildHeaders(),
  });
}

function buildMethodNotAllowed() {
  return buildJsonResponse(405, {
    error: '不支持的请求方法。',
  });
}

function buildForbiddenResponse(message: string) {
  return buildJsonResponse(403, {
    error: message,
  });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    throw new Error('请求体不是合法 JSON。');
  }
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isSameOriginWriteRequest(request: Request, requestUrl: URL) {
  const originHeader = request.headers.get('Origin')?.trim();
  if (originHeader) {
    return originHeader === requestUrl.origin;
  }

  const refererHeader = request.headers.get('Referer')?.trim();
  if (!refererHeader) {
    return false;
  }

  try {
    return new URL(refererHeader).origin === requestUrl.origin;
  } catch {
    return false;
  }
}

function ensureAdminWriteRequestAllowed(request: Request, requestUrl: URL) {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return null;
  }

  if (isSameOriginWriteRequest(request, requestUrl)) {
    return null;
  }

  return buildForbiddenResponse('请求来源校验失败，当前操作已被拒绝。');
}

export async function handleAdminRequest(context: PagesContext) {
  const config = getAdminConfig(context.env);
  const requestUrl = new URL(context.request.url);
  const subPath = getAdminSubPath(config.basePath, requestUrl.pathname);

  if (!subPath) {
    return null;
  }

  const access = await requireAdminAccess({
    data: context.data ?? {},
    env: context.env,
    functionPath: context.functionPath ?? '',
    next: async () => new Response(null, { status: 204 }),
    passThroughOnException: context.passThroughOnException ?? (() => {}),
    request: context.request,
    waitUntil: context.waitUntil ?? (() => {}),
  }, config);

  if (!access.ok) {
    return access.response;
  }

  const db = getAdminDatabase(context.env.AUTH_DB);
  const now = Math.floor(Date.now() / 1000);

  if (subPath === '/' && context.request.method === 'GET') {
    return buildHtmlResponse(renderAdminPage(config, access.identity, adminRouteOptions));
  }

  const writeGuardResponse = ensureAdminWriteRequestAllowed(context.request, requestUrl);
  if (writeGuardResponse) {
    return writeGuardResponse;
  }

  if (subPath === '/api/tokens' && context.request.method === 'GET') {
    const { invites, summary } = await listAdminInvites(db, now);

    return buildJsonResponse(200, {
      actor: access.identity,
      items: invites,
      summary,
    });
  }

  if (subPath === '/api/tokens' && context.request.method === 'POST') {
    try {
      const body = await readJsonBody(context.request);
      const result = await createAdminInvite(
        db,
        {
          baseUrl: requestUrl.origin,
          maxUses: readNumber(body.maxUses),
          mode: (readString(body.mode) ?? 'single_use') as 'single_use' | 'reusable_until_expire' | 'limited_uses',
          nextPath: readString(body.nextPath) ?? '/',
          note: readString(body.note),
          sessionPolicy: (readString(body.sessionPolicy) ?? 'fixed_ttl') as 'fixed_ttl' | 'cap_to_invite_expiry',
          sessionTtlMinutes: readNumber(body.sessionTtlMinutes) ?? 20160,
          ttlMinutes: readNumber(body.ttlMinutes) ?? 15,
        },
        access.identity.email,
        now,
      );

      return buildJsonResponse(201, {
        item: result.invite,
        qrSvg: result.qrSvg,
        token: result.token,
        unlockUrl: result.unlockUrl,
      });
    } catch (error) {
      return buildJsonResponse(400, {
        error: error instanceof Error ? error.message : '创建短码失败。',
      });
    }
  }

  const disableMatch = subPath.match(/^\/api\/tokens\/([^/]+)\/disable$/);
  if (disableMatch) {
    if (context.request.method !== 'POST') {
      return buildMethodNotAllowed();
    }

    try {
      const inviteId = disableMatch[1];
      const body = await readJsonBody(context.request);
      const changed = await disableAdminInvite(db, inviteId, readString(body.reason), now);

      if (!changed) {
        return buildJsonResponse(404, {
          error: '未找到可禁用的短码，或该短码已经处于禁用状态。',
        });
      }

      if (body.revokeSessions === true) {
        await revokeSessionsByInviteId(db, inviteId, now);
      }

      const invite = await readAdminInvite(db, inviteId, now);

      return buildJsonResponse(200, {
        item: invite,
      });
    } catch (error) {
      return buildJsonResponse(400, {
        error: error instanceof Error ? error.message : '禁用短码失败。',
      });
    }
  }

  const extendMatch = subPath.match(/^\/api\/tokens\/([^/]+)\/extend$/);
  if (extendMatch) {
    if (context.request.method !== 'POST') {
      return buildMethodNotAllowed();
    }

    try {
      const inviteId = extendMatch[1];
      const body = await readJsonBody(context.request);
      const changed = await extendAdminInvite(db, inviteId, readNumber(body.extendMinutes) ?? 0, now);

      if (!changed) {
        return buildJsonResponse(404, {
          error: '未找到需要延长的短码。',
        });
      }

      const invite = await readAdminInvite(db, inviteId, now);

      return buildJsonResponse(200, {
        item: invite,
      });
    } catch (error) {
      return buildJsonResponse(400, {
        error: error instanceof Error ? error.message : '延长短码失败。',
      });
    }
  }

  const addUsesMatch = subPath.match(/^\/api\/tokens\/([^/]+)\/add-uses$/);
  if (addUsesMatch) {
    if (context.request.method !== 'POST') {
      return buildMethodNotAllowed();
    }

    try {
      const inviteId = addUsesMatch[1];
      const body = await readJsonBody(context.request);
      const changed = await addAdminInviteUses(db, inviteId, readNumber(body.additionalUses) ?? 0, now);

      if (!changed) {
        return buildJsonResponse(404, {
          error: '未找到需要增加次数的短码。',
        });
      }

      const invite = await readAdminInvite(db, inviteId, now);

      return buildJsonResponse(200, {
        item: invite,
      });
    } catch (error) {
      return buildJsonResponse(400, {
        error: error instanceof Error ? error.message : '增加可用次数失败。',
      });
    }
  }

  const enableMatch = subPath.match(/^\/api\/tokens\/([^/]+)\/enable$/);
  if (enableMatch) {
    if (context.request.method !== 'POST') {
      return buildMethodNotAllowed();
    }

    try {
      const inviteId = enableMatch[1];
      const changed = await enableAdminInvite(db, inviteId, now);

      if (!changed) {
        return buildJsonResponse(404, {
          error: '未找到需要启用的短码。',
        });
      }

      const invite = await readAdminInvite(db, inviteId, now);

      return buildJsonResponse(200, {
        item: invite,
      });
    } catch (error) {
      return buildJsonResponse(400, {
        error: error instanceof Error ? error.message : '启用短码失败。',
      });
    }
  }

  return buildJsonResponse(404, {
    error: '后台路径不存在。',
  });
}
