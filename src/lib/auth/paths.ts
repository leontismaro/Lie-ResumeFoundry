import { normalizeAuthPath } from './config';

export function sanitizeSitePath(input: string | null | undefined, origin: string) {
  if (!input) {
    return '/';
  }

  try {
    const url = new URL(input, origin);
    if (url.origin !== origin) {
      return '/';
    }

    return `${normalizeAuthPath(url.pathname)}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
