import fs from 'node:fs/promises';
import path from 'node:path';

const contentRoot = path.resolve('src/content/resumes');
const outputFile = path.resolve('src/generated/admin-route-options.ts');

function parseScalar(value) {
  const trimmed = value.trim();

  if (trimmed === 'true') {
    return true;
  }

  if (trimmed === 'false') {
    return false;
  }

  if (/^-?\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }

  return trimmed.replace(/^['"]|['"]$/g, '');
}

function parseFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    throw new Error('未找到 frontmatter。');
  }

  const lines = match[1].split('\n');
  const data = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1);
    data[key] = parseScalar(value);
  }

  return data;
}

function buildRouteOptions(resumes) {
  const options = [];

  for (const resume of resumes) {
    if (resume.isMaster) {
      options.push(
        {
          label: `${resume.label}（主页网页版）`,
          value: '/',
        },
        {
          label: `${resume.label}（主页打印版）`,
          value: '/print',
        },
      );
      continue;
    }

    options.push(
      {
        label: `${resume.label}（网页版）`,
        value: `/resume/${resume.id}`,
      },
      {
        label: `${resume.label}（打印版）`,
        value: `/resume/${resume.id}/print`,
      },
    );
  }

  options.push({
    label: '简历目录页',
    value: '/resumes',
  });

  return options;
}

async function main() {
  const entries = await fs.readdir(contentRoot, { withFileTypes: true });
  const resumes = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const metaFile = path.join(contentRoot, entry.name, '_meta.md');
    const source = await fs.readFile(metaFile, 'utf8');
    const frontmatter = parseFrontmatter(source);

    resumes.push({
      id: entry.name,
      isMaster: frontmatter.isMaster === true,
      label: String(frontmatter.label || entry.name),
      order: typeof frontmatter.order === 'number' ? frontmatter.order : Number.MAX_SAFE_INTEGER,
    });
  }

  resumes.sort((left, right) => left.order - right.order);

  const routeOptions = buildRouteOptions(resumes);
  const fileContent = `export interface AdminRouteOption {
  label: string;
  value: string;
}

export const adminRouteOptions: AdminRouteOption[] = ${JSON.stringify(routeOptions, null, 2)};\n`;

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, fileContent, 'utf8');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
