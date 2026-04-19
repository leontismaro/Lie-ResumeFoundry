export interface CookieOptions {
  domain?: string;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: 'Lax' | 'None' | 'Strict';
  secure?: boolean;
}

export function parseCookies(header: string | null) {
  if (!header) {
    return new Map<string, string>();
  }

  const cookies = new Map<string, string>();

  for (const part of header.split(';')) {
    const [rawName, ...rawValue] = part.split('=');
    const name = rawName?.trim();
    if (!name) {
      continue;
    }

    const value = rawValue.join('=').trim();
    cookies.set(name, decodeURIComponent(value));
  }

  return cookies;
}

export function getCookie(header: string | null, name: string) {
  return parseCookies(header).get(name) ?? null;
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  parts.push(`Path=${options.path ?? '/'}`);
  parts.push(`SameSite=${options.sameSite ?? 'Lax'}`);

  if (typeof options.maxAge === 'number') {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }

  if (options.secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function clearCookie(name: string, options: Omit<CookieOptions, 'maxAge'> = {}) {
  return serializeCookie(name, '', {
    ...options,
    maxAge: 0,
  });
}
