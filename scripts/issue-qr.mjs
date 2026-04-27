import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import QRCode from 'qrcode';

const DEFAULT_BASE_URL = process.env.PUBLIC_SITE_URL ?? 'https://resume.example.com';
const DEFAULT_DATABASE_NAME = process.env.D1_DATABASE_NAME ?? 'lies-resumefoundry-auth';
const DEFAULT_NEXT_PATH = '/';
const DEFAULT_TTL_MINUTES = Number.parseInt(process.env.AUTH_QR_DEFAULT_TTL_MINUTES ?? '15', 10);
const DEFAULT_SESSION_TTL_MINUTES = Number.parseInt(process.env.AUTH_SESSION_TTL_MINUTES ?? '20160', 10);
const DEFAULT_MODE = 'single_use';
const DEFAULT_SESSION_POLICY = 'fixed_ttl';
const DEFAULT_QR_TOKEN_BYTES = 10;

const VALID_MODES = new Set(['single_use', 'reusable_until_expire', 'limited_uses']);
const VALID_SESSION_POLICIES = new Set(['fixed_ttl', 'cap_to_invite_expiry']);

function parseArgs(argv) {
  const args = {
    baseUrl: DEFAULT_BASE_URL,
    database: DEFAULT_DATABASE_NAME,
    maxUses: null,
    mode: DEFAULT_MODE,
    next: DEFAULT_NEXT_PATH,
    note: '',
    out: '',
    remote: true,
    sessionPolicy: DEFAULT_SESSION_POLICY,
    sessionTtlMinutes: Number.isFinite(DEFAULT_SESSION_TTL_MINUTES) && DEFAULT_SESSION_TTL_MINUTES > 0
      ? DEFAULT_SESSION_TTL_MINUTES
      : 20160,
    ttlMinutes: Number.isFinite(DEFAULT_TTL_MINUTES) && DEFAULT_TTL_MINUTES > 0 ? DEFAULT_TTL_MINUTES : 15,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--base-url') {
      args.baseUrl = argv[index + 1] ?? args.baseUrl;
      index += 1;
      continue;
    }

    if (arg === '--database') {
      args.database = argv[index + 1] ?? args.database;
      index += 1;
      continue;
    }

    if (arg === '--next') {
      args.next = argv[index + 1] ?? args.next;
      index += 1;
      continue;
    }

    if (arg === '--note') {
      args.note = argv[index + 1] ?? args.note;
      index += 1;
      continue;
    }

    if (arg === '--mode') {
      const value = argv[index + 1] ?? '';
      if (VALID_MODES.has(value)) {
        args.mode = value;
      }
      index += 1;
      continue;
    }

    if (arg === '--max-uses') {
      const value = Number.parseInt(argv[index + 1] ?? '', 10);
      if (Number.isFinite(value) && value > 0) {
        args.maxUses = value;
      }
      index += 1;
      continue;
    }

    if (arg === '--out') {
      args.out = argv[index + 1] ?? args.out;
      index += 1;
      continue;
    }

    if (arg === '--ttl-minutes') {
      const value = Number.parseInt(argv[index + 1] ?? '', 10);
      if (Number.isFinite(value) && value > 0) {
        args.ttlMinutes = value;
      }
      index += 1;
      continue;
    }

    if (arg === '--session-policy') {
      const value = argv[index + 1] ?? '';
      if (VALID_SESSION_POLICIES.has(value)) {
        args.sessionPolicy = value;
      }
      index += 1;
      continue;
    }

    if (arg === '--session-ttl-minutes') {
      const value = Number.parseInt(argv[index + 1] ?? '', 10);
      if (Number.isFinite(value) && value > 0) {
        args.sessionTtlMinutes = value;
      }
      index += 1;
      continue;
    }

    if (arg === '--local') {
      args.remote = false;
      continue;
    }

    if (arg === '--remote') {
      args.remote = true;
      continue;
    }
  }

  return args;
}

function base64UrlEncode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createToken(size = DEFAULT_QR_TOKEN_BYTES) {
  return base64UrlEncode(crypto.randomBytes(size));
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function sqlEscape(value) {
  return value.replace(/'/g, "''");
}

function formatTimestamp(date = new Date()) {
  const parts = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
    '-',
    String(date.getUTCHours()).padStart(2, '0'),
    String(date.getUTCMinutes()).padStart(2, '0'),
    String(date.getUTCSeconds()).padStart(2, '0'),
  ];

  return parts.join('');
}

function formatDateTime(value, timeZone = 'Asia/Shanghai') {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    hour12: false,
    timeZone,
  }).format(value);
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return `${minutes} 分钟`;
  }

  if (minutes < 60) {
    return `${minutes} 分钟`;
  }

  const totalHours = minutes / 60;
  if (Number.isInteger(totalHours) && totalHours < 24) {
    return `${minutes} 分钟（${totalHours} 小时）`;
  }

  if (Number.isInteger(totalHours / 24)) {
    return `${minutes} 分钟（${totalHours / 24} 天）`;
  }

  const hours = Math.floor(totalHours);
  const remainingMinutes = minutes % 60;

  if (hours < 24) {
    return remainingMinutes > 0
      ? `${minutes} 分钟（${hours} 小时 ${remainingMinutes} 分钟）`
      : `${minutes} 分钟（${hours} 小时）`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  const parts = [`${days} 天`];
  if (remainingHours > 0) {
    parts.push(`${remainingHours} 小时`);
  }
  if (remainingMinutes > 0) {
    parts.push(`${remainingMinutes} 分钟`);
  }

  return `${minutes} 分钟（${parts.join(' ')})`;
}

function buildOutputPath(explicitPath) {
  if (explicitPath) {
    return path.resolve(explicitPath);
  }

  return path.resolve('generated-qr', `invite-${formatTimestamp()}.svg`);
}

async function writeQrFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

function buildInviteSql(record) {
  return `
    insert into invite_tokens (
      id,
      token_hash,
      next_path,
      note,
      mode,
      max_uses,
      used_count,
      expires_at,
      consumed_at,
      session_policy,
      session_ttl_seconds,
      disabled_at,
      disabled_reason,
      created_at,
      created_by,
      updated_at
    )
    values (
      '${sqlEscape(record.id)}',
      '${sqlEscape(record.tokenHash)}',
      '${sqlEscape(record.nextPath)}',
      ${record.note ? `'${sqlEscape(record.note)}'` : 'null'},
      '${sqlEscape(record.mode)}',
      ${record.maxUses ?? 'null'},
      0,
      ${record.expiresAt},
      null,
      '${sqlEscape(record.sessionPolicy)}',
      ${record.sessionTtlSeconds},
      null,
      null,
      ${record.createdAt},
      null,
      ${record.createdAt}
    )
  `;
}

function executeWrangler(databaseName, sql, remote) {
  const args = [
    'wrangler',
    'd1',
    'execute',
    databaseName,
    remote ? '--remote' : '--local',
    '--config',
    'wrangler.jsonc',
    '--command',
    sql,
  ];

  const result = spawnSync('npx', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'wrangler d1 execute 失败。');
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = new URL(options.baseUrl);

  if (!options.next.startsWith('/')) {
    throw new Error('--next 必须是站内路径，例如 /、/print 或 /resume/ai-platform');
  }

  if (options.mode === 'limited_uses' && !options.maxUses) {
    throw new Error('limited_uses 模式必须同时传入 --max-uses。');
  }

  const token = createToken();
  const tokenHash = hashToken(token);
  const createdAt = Math.floor(Date.now() / 1000);
  const expiresAt = createdAt + options.ttlMinutes * 60;
  const record = {
    createdAt,
    expiresAt,
    id: crypto.randomUUID(),
    maxUses: options.maxUses,
    mode: options.mode,
    nextPath: options.next,
    note: options.note,
    sessionPolicy: options.sessionPolicy,
    sessionTtlSeconds: options.sessionTtlMinutes * 60,
    tokenHash,
  };

  executeWrangler(options.database, buildInviteSql(record), options.remote);

  const authUrl = new URL('/', baseUrl);
  authUrl.hash = token;

  const svg = await QRCode.toString(authUrl.toString(), {
    margin: 1,
    type: 'svg',
    width: 512,
  });
  const outputPath = buildOutputPath(options.out);

  await writeQrFile(outputPath, svg);

  console.log(`二维码已写入: ${outputPath}`);
  console.log(`邀请链接: ${authUrl.toString()}`);
  console.log(`访问模式: ${record.mode}`);
  if (record.mode === 'limited_uses') {
    console.log(`最大使用次数: ${record.maxUses}`);
  }
  console.log(`邀请码有效期: ${formatDuration(options.ttlMinutes)}`);
  console.log(`过期时间(UTC): ${new Date(expiresAt * 1000).toISOString()}`);
  console.log(`过期时间(北京时间): ${formatDateTime(new Date(expiresAt * 1000), 'Asia/Shanghai')}`);
  console.log(`Session 策略: ${record.sessionPolicy}`);
  console.log(`Session 有效期: ${formatDuration(options.sessionTtlMinutes)}`);
  if (options.note) {
    console.log(`备注: ${options.note}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
