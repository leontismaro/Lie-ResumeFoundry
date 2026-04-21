function normalizeBasePath(basePath: string) {
  if (!basePath || basePath === '/') {
    return '/';
  }

  const withLeadingSlash = basePath.startsWith('/') ? basePath : `/${basePath}`;
  return withLeadingSlash.replace(/\/+$/g, '') || '/';
}

function isExternalPath(path: string) {
  return /^(?:[a-z][a-z\d+\-.]*:)?\/\//i.test(path) || /^[a-z][a-z\d+\-.]*:/i.test(path);
}

export function withBase(path: string) {
  if (!path) {
    return import.meta.env.BASE_URL;
  }

  if (path.startsWith('#') || path.startsWith('?') || isExternalPath(path)) {
    return path;
  }

  const basePath = normalizeBasePath(import.meta.env.BASE_URL);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (basePath === '/') {
    return normalizedPath;
  }

  if (normalizedPath === '/') {
    return `${basePath}/`;
  }

  return `${basePath}${normalizedPath}`;
}

export function getCanonicalUrl(currentUrl: URL, site: URL | undefined) {
  if (!site) {
    return undefined;
  }

  return new URL(currentUrl.pathname, site).toString();
}
