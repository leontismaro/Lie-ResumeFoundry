import cloudflareAccessPlugin from '@cloudflare/pages-plugin-cloudflare-access';
import type { PluginData } from '@cloudflare/pages-plugin-cloudflare-access';
import { clearCookie, getCookie, serializeCookie } from '../auth/cookies';
import { normalizeAuthPath } from '../auth/config';
import {
  clearRateLimit,
  getClientAddress,
  readRateLimitState,
  recordFailedRateLimitAttempt,
} from '../auth/rate-limit';
import { getAuthDatabase, type D1DatabaseLike } from '../auth/storage';
import { isAdminPath, type AdminConfig } from './config';
import { renderAdminLoginPage } from './login-page';

const ADMIN_LOGIN_RATE_LIMIT_SCOPE = 'admin_login_ip';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface AdminIdentity {
  authMethod: 'access' | 'local';
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

interface AdminAuthEndpointContext {
  env: Record<string, unknown>;
  request: Request;
}

interface AdminSessionPayload {
  email: string;
  exp: number;
  iat: number;
  sub: 'admin';
  v: 1;
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

function buildHtmlResponse(status: number, html: string, extraHeaders?: HeadersInit) {
  return new Response(html, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      'Content-Type': 'text/html; charset=utf-8',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-Robots-Tag': 'noindex, noarchive, nosnippet',
      ...extraHeaders,
    },
  });
}

function buildRedirectResponse(location: string, headers?: HeadersInit) {
  return new Response(null, {
    status: 303,
    headers: {
      'Cache-Control': 'private, no-store',
      Location: location,
      ...headers,
    },
  });
}

function buildMethodNotAllowedResponse() {
  return new Response('不支持的请求方法。', {
    status: 405,
    headers: {
      Allow: 'GET, POST',
      'Cache-Control': 'private, no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Robots-Tag': 'noindex, noarchive, nosnippet',
    },
  });
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(value: string) {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  } catch {
    return null;
  }
}

function stringToBase64Url(value: string) {
  return bytesToBase64Url(textEncoder.encode(value));
}

function base64UrlToString(value: string) {
  const bytes = base64UrlToBytes(value);
  if (!bytes) {
    return null;
  }

  try {
    return textDecoder.decode(bytes);
  } catch {
    return null;
  }
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }

  return difference === 0;
}

function parsePasswordHash(value: string | undefined) {
  if (!value) {
    return null;
  }

  const [algorithm, iterationsValue, saltValue, hashValue] = value.split('$');
  const iterations = Number.parseInt(iterationsValue ?? '', 10);
  const salt = base64UrlToBytes(saltValue ?? '');
  const hash = base64UrlToBytes(hashValue ?? '');

  if (
    algorithm !== 'pbkdf2-sha256' ||
    !Number.isFinite(iterations) ||
    iterations < 100000 ||
    !salt ||
    salt.length === 0 ||
    !hash ||
    hash.length === 0
  ) {
    return null;
  }

  return {
    hash,
    iterations,
    salt,
  };
}

function isLocalAuthEnabled(config: AdminConfig) {
  return config.authMode === 'local' || config.authMode === 'access_with_local_fallback';
}

function isLocalPasswordConfigured(config: AdminConfig) {
  return parsePasswordHash(config.passwordHash) !== null;
}

async function verifyAdminPassword(config: AdminConfig, password: string) {
  const parsed = parsePasswordHash(config.passwordHash);
  if (!parsed || !password) {
    return false;
  }

  const keyMaterial = await crypto.subtle.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const derived = await crypto.subtle.deriveBits(
    {
      hash: 'SHA-256',
      iterations: parsed.iterations,
      name: 'PBKDF2',
      salt: parsed.salt,
    },
    keyMaterial,
    parsed.hash.length * 8,
  );

  return timingSafeEqual(new Uint8Array(derived), parsed.hash);
}

function getAdminSessionSecret(config: AdminConfig) {
  return config.sessionSecret ?? config.passwordHash ?? null;
}

async function signAdminSession(config: AdminConfig, data: string) {
  const secret = getAdminSessionSecret(config);
  if (!secret) {
    return null;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    {
      hash: 'SHA-256',
      name: 'HMAC',
    },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(data));

  return bytesToBase64Url(new Uint8Array(signature));
}

async function verifyAdminSessionSignature(config: AdminConfig, data: string, signature: string) {
  const expected = await signAdminSession(config, data);
  if (!expected) {
    return false;
  }

  return timingSafeEqual(textEncoder.encode(signature), textEncoder.encode(expected));
}

async function createAdminSessionCookie(config: AdminConfig, requestUrl: URL, now: number) {
  const payload: AdminSessionPayload = {
    email: config.userEmail,
    exp: now + config.sessionTtlSeconds,
    iat: now,
    sub: 'admin',
    v: 1,
  };
  const encodedPayload = stringToBase64Url(JSON.stringify(payload));
  const signedData = `v1.${encodedPayload}`;
  const signature = await signAdminSession(config, signedData);

  if (!signature) {
    throw new Error('缺少后台 session 签名密钥。');
  }

  return serializeCookie(config.sessionCookieName, `${signedData}.${signature}`, {
    maxAge: config.sessionTtlSeconds,
    path: config.basePath,
    sameSite: 'Strict',
    secure: requestUrl.protocol === 'https:',
  });
}

function clearAdminSessionCookie(config: AdminConfig, requestUrl: URL) {
  return clearCookie(config.sessionCookieName, {
    path: config.basePath,
    sameSite: 'Strict',
    secure: requestUrl.protocol === 'https:',
  });
}

async function readLocalAdminSession(request: Request, config: AdminConfig, now: number) {
  const cookie = getCookie(request.headers.get('Cookie'), config.sessionCookieName);
  if (!cookie) {
    return null;
  }

  const [version, encodedPayload, signature, ...extra] = cookie.split('.');
  if (version !== 'v1' || !encodedPayload || !signature || extra.length > 0) {
    return null;
  }

  const signedData = `${version}.${encodedPayload}`;
  const verified = await verifyAdminSessionSignature(config, signedData, signature);
  if (!verified) {
    return null;
  }

  const payloadJson = base64UrlToString(encodedPayload);
  if (!payloadJson) {
    return null;
  }

  try {
    const payload = JSON.parse(payloadJson) as Partial<AdminSessionPayload>;
    if (payload.v !== 1 || payload.sub !== 'admin' || !payload.email || !payload.exp || payload.exp <= now) {
      return null;
    }

    return {
      authMethod: 'local',
      email: payload.email,
    } satisfies AdminIdentity;
  } catch {
    return null;
  }
}

function sanitizeAdminNextPath(input: string | null | undefined, origin: string, config: AdminConfig) {
  if (!input) {
    return config.basePath;
  }

  try {
    const url = new URL(input, origin);
    const normalizedPath = normalizeAuthPath(url.pathname);

    if (url.origin !== origin || !isAdminPath(config.basePath, normalizedPath)) {
      return config.basePath;
    }

    if (normalizedPath === `${config.basePath}/login` || normalizedPath === `${config.basePath}/logout`) {
      return config.basePath;
    }

    return `${normalizedPath}${url.search}`;
  } catch {
    return config.basePath;
  }
}

function buildLoginLocation(config: AdminConfig, requestUrl: URL) {
  const nextPath = sanitizeAdminNextPath(`${requestUrl.pathname}${requestUrl.search}`, requestUrl.origin, config);
  const loginUrl = new URL(`${config.basePath}/login`, requestUrl.origin);
  loginUrl.searchParams.set('next', nextPath);
  return loginUrl.toString();
}

function readStringFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : null;
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

function getOptionalAuthDatabase(binding: unknown) {
  try {
    return getAuthDatabase(binding);
  } catch (error) {
    console.error('后台登录限流无法读取 AUTH_DB，已降级为仅校验密码。', error);
    return null;
  }
}

async function safeReadAdminLoginRateLimitState(db: D1DatabaseLike | null, subject: string, now: number) {
  if (!db) {
    return {
      blocked: false,
      retryAfterSeconds: 0,
    };
  }

  try {
    return await readRateLimitState(db, ADMIN_LOGIN_RATE_LIMIT_SCOPE, subject, now);
  } catch (error) {
    console.error('读取后台登录限流状态失败，已降级为仅校验密码。', error);
    return {
      blocked: false,
      retryAfterSeconds: 0,
    };
  }
}

async function safeRecordFailedAdminLoginAttempt(
  db: D1DatabaseLike | null,
  subject: string,
  now: number,
  config: AdminConfig,
) {
  if (!db) {
    return {
      blocked: false,
      retryAfterSeconds: 0,
    };
  }

  try {
    return await recordFailedRateLimitAttempt(db, ADMIN_LOGIN_RATE_LIMIT_SCOPE, subject, now, {
      maxAttempts: config.loginRateLimitMaxAttempts,
      windowSeconds: config.loginRateLimitWindowSeconds,
    });
  } catch (error) {
    console.error('记录后台登录失败次数失败，已降级为仅校验密码。', error);
    return {
      blocked: false,
      retryAfterSeconds: 0,
    };
  }
}

async function safeClearAdminLoginRateLimit(db: D1DatabaseLike | null, subject: string) {
  if (!db) {
    return;
  }

  try {
    await clearRateLimit(db, ADMIN_LOGIN_RATE_LIMIT_SCOPE, subject);
  } catch (error) {
    console.error('清理后台登录限流状态失败，已忽略。', error);
  }
}

async function requireCloudflareAccess(
  context: AdminAccessContext,
  config: AdminConfig,
): Promise<AdminAccessResult> {
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
      authMethod: 'access',
      email: email || 'service-user',
    },
    ok: true,
  };
}

async function requireLocalAdminAccess(request: Request, config: AdminConfig): Promise<AdminAccessResult> {
  if (!isLocalPasswordConfigured(config)) {
    return {
      ok: false,
      response: buildConfigErrorResponse('缺少有效 ADMIN_PASSWORD_HASH，无法启用本地后台密码。'),
    };
  }

  const requestUrl = new URL(request.url);
  const now = Math.floor(Date.now() / 1000);
  const identity = await readLocalAdminSession(request, config, now);
  if (identity) {
    return {
      identity,
      ok: true,
    };
  }

  const hasCookie = Boolean(getCookie(request.headers.get('Cookie'), config.sessionCookieName));

  return {
    ok: false,
    response: buildRedirectResponse(buildLoginLocation(config, requestUrl), {
      ...(hasCookie ? { 'Set-Cookie': clearAdminSessionCookie(config, requestUrl) } : {}),
    }),
  };
}

async function handleAdminLoginRequest(
  context: AdminAuthEndpointContext,
  config: AdminConfig,
  requestUrl: URL,
) {
  if (!isLocalAuthEnabled(config)) {
    return new Response('后台登录未启用。', {
      status: 404,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, noarchive, nosnippet',
      },
    });
  }

  if (!isLocalPasswordConfigured(config)) {
    return buildConfigErrorResponse('缺少有效 ADMIN_PASSWORD_HASH，无法启用本地后台密码。');
  }

  let nextPath = sanitizeAdminNextPath(requestUrl.searchParams.get('next'), requestUrl.origin, config);

  if (context.request.method === 'GET') {
    const identity = await readLocalAdminSession(context.request, config, Math.floor(Date.now() / 1000));
    if (identity) {
      return buildRedirectResponse(new URL(nextPath, requestUrl.origin).toString());
    }

    return buildHtmlResponse(200, renderAdminLoginPage(config, { nextPath }));
  }

  if (context.request.method !== 'POST') {
    return buildMethodNotAllowedResponse();
  }

  if (!isSameOriginWriteRequest(context.request, requestUrl)) {
    return buildHtmlResponse(
      403,
      renderAdminLoginPage(config, {
        error: '请求来源无效。',
        nextPath,
      }),
    );
  }

  const formData = await context.request.formData();
  nextPath = sanitizeAdminNextPath(readStringFormValue(formData, 'next'), requestUrl.origin, config);
  const password = readStringFormValue(formData, 'password') ?? '';
  const now = Math.floor(Date.now() / 1000);
  const clientAddress = getClientAddress(context.request);
  const db = getOptionalAuthDatabase(context.env.AUTH_DB);
  const currentRateLimit = await safeReadAdminLoginRateLimitState(db, clientAddress, now);

  if (currentRateLimit.blocked) {
    return buildHtmlResponse(
      429,
      renderAdminLoginPage(config, {
        error: '尝试次数过多。请稍后再试。',
        nextPath,
      }),
      {
        'Retry-After': String(currentRateLimit.retryAfterSeconds),
      },
    );
  }

  const passwordVerified = await verifyAdminPassword(config, password);
  if (!passwordVerified) {
    const rateLimit = await safeRecordFailedAdminLoginAttempt(db, clientAddress, now, config);

    return buildHtmlResponse(
      rateLimit.blocked ? 429 : 401,
      renderAdminLoginPage(config, {
        error: rateLimit.blocked ? '尝试次数过多。请稍后再试。' : '密码不正确。',
        nextPath,
      }),
      {
        ...(rateLimit.blocked ? { 'Retry-After': String(rateLimit.retryAfterSeconds) } : {}),
      },
    );
  }

  await safeClearAdminLoginRateLimit(db, clientAddress);

  return buildRedirectResponse(new URL(nextPath, requestUrl.origin).toString(), {
    'Set-Cookie': await createAdminSessionCookie(config, requestUrl, now),
  });
}

function handleAdminLogoutRequest(context: AdminAuthEndpointContext, config: AdminConfig, requestUrl: URL) {
  if (context.request.method !== 'POST') {
    return buildMethodNotAllowedResponse();
  }

  if (!isSameOriginWriteRequest(context.request, requestUrl)) {
    return new Response('请求来源校验失败，当前操作已被拒绝。', {
      status: 403,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, noarchive, nosnippet',
      },
    });
  }

  return buildRedirectResponse(new URL(config.basePath, requestUrl.origin).toString(), {
    'Set-Cookie': clearAdminSessionCookie(config, requestUrl),
  });
}

export async function handleAdminAuthRequest(
  context: AdminAuthEndpointContext,
  config: AdminConfig,
  subPath: string,
) {
  const requestUrl = new URL(context.request.url);

  if (subPath === '/login') {
    return handleAdminLoginRequest(context, config, requestUrl);
  }

  if (subPath === '/logout') {
    return handleAdminLogoutRequest(context, config, requestUrl);
  }

  return null;
}

export async function requireAdminAccess(
  context: AdminAccessContext,
  config: AdminConfig,
): Promise<AdminAccessResult> {
  if (config.authMode === 'local') {
    return requireLocalAdminAccess(context.request, config);
  }

  if (config.authMode === 'access') {
    return requireCloudflareAccess(context, config);
  }

  const now = Math.floor(Date.now() / 1000);
  const localIdentity = await readLocalAdminSession(context.request, config, now);
  if (localIdentity) {
    return {
      identity: localIdentity,
      ok: true,
    };
  }

  const accessJwt = context.request.headers.get('Cf-Access-Jwt-Assertion')?.trim();
  if (accessJwt && config.accessDomain && config.accessAud) {
    return requireCloudflareAccess(context, config);
  }

  return requireLocalAdminAccess(context.request, config);
}
