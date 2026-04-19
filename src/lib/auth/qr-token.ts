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

function isLikelyToken(value: string) {
  return /^[A-Za-z0-9_-]{24,256}$/.test(value);
}

export function createQrToken(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function hashQrToken(token: string) {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(digest));

  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function normalizeQrToken(input: string | null | undefined) {
  if (!input) {
    return null;
  }

  const value = input.trim();
  return isLikelyToken(value) ? value : null;
}
