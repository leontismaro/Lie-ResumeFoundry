// @ts-check
import { defineConfig } from 'astro/config';

function normalizeBasePath(basePath) {
  if (!basePath || basePath === '/') {
    return '/';
  }

  const withLeadingSlash = basePath.startsWith('/') ? basePath : `/${basePath}`;
  return withLeadingSlash.replace(/\/+$/g, '') || '/';
}

const site = process.env.SITE_URL?.trim();
const base = normalizeBasePath(process.env.SITE_BASE?.trim() || '/');

// https://astro.build/config
export default defineConfig({
  ...(site ? { site } : {}),
  base,
});
