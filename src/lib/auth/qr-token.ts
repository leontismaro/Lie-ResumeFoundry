export const QR_TOKEN_BYTE_LENGTH = 10;
export const QR_TOKEN_MIN_LENGTH = 14;
export const QR_TOKEN_MAX_LENGTH = 256;
export const QR_TOKEN_PATTERN_SOURCE = `[A-Za-z0-9_-]{${QR_TOKEN_MIN_LENGTH},${QR_TOKEN_MAX_LENGTH}}`;

const QR_TOKEN_PATTERN = new RegExp(`^${QR_TOKEN_PATTERN_SOURCE}$`);

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
  return QR_TOKEN_PATTERN.test(value);
}

export function createQrToken(size = QR_TOKEN_BYTE_LENGTH) {
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
