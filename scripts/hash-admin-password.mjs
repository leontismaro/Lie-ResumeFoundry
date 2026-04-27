import { pbkdf2Sync, randomBytes } from 'node:crypto';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';

const ITERATIONS = 310000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 24;

function toBase64Url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function readPassword() {
  const argumentPassword = process.argv[2];
  if (argumentPassword) {
    return argumentPassword;
  }

  if (process.env.ADMIN_PASSWORD) {
    return process.env.ADMIN_PASSWORD;
  }

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return await readline.question('Admin password: ');
  } finally {
    readline.close();
  }
}

async function main() {
  const password = await readPassword();
  if (password.length < 12) {
    throw new Error('后台密码至少需要 12 个字符。');
  }

  const salt = randomBytes(SALT_LENGTH);
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');

  console.log(`pbkdf2-sha256$${ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
