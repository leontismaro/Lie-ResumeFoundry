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

function isLikelySessionId(value: string) {
  return /^[A-Za-z0-9_-]{24,256}$/.test(value);
}

export function createSessionId(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export function normalizeSessionId(input: string | null | undefined) {
  if (!input) {
    return null;
  }

  const value = input.trim();
  return isLikelySessionId(value) ? value : null;
}
