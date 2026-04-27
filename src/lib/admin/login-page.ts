import type { AdminConfig } from './config';

interface AdminLoginPageOptions {
  error?: string;
  nextPath: string;
  status?: number;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderAdminLoginPage(config: AdminConfig, options: AdminLoginPageOptions) {
  const errorMarkup = options.error
    ? `<div class="notice" role="alert">${escapeHtml(options.error)}</div>`
    : '';

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow,noarchive,nosnippet" />
    <title>后台登录</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5efe4;
        --panel: rgba(255, 250, 242, 0.94);
        --line: rgba(93, 62, 31, 0.16);
        --text: #2d2217;
        --muted: #75614d;
        --accent: #a34722;
        --accent-strong: #7f3516;
        --bad: #8d251f;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        font-family: "IBM Plex Sans", "Noto Sans SC", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(183, 110, 42, 0.18), transparent 32%),
          linear-gradient(180deg, #f8f2e8 0%, var(--bg) 100%);
      }

      main {
        width: min(420px, 100%);
        border: 1px solid var(--line);
        border-radius: 22px;
        background: var(--panel);
        padding: 28px;
        box-shadow: 0 18px 48px rgba(70, 38, 12, 0.12);
      }

      h1 {
        margin: 0;
        font-size: 1.8rem;
        line-height: 1.1;
      }

      p {
        margin: 8px 0 0;
        color: var(--muted);
        line-height: 1.6;
      }

      form {
        display: grid;
        gap: 14px;
        margin-top: 22px;
      }

      label {
        color: var(--muted);
        font-size: 0.92rem;
      }

      input,
      button {
        width: 100%;
        font: inherit;
      }

      input {
        border: 1px solid rgba(93, 62, 31, 0.14);
        border-radius: 14px;
        padding: 12px 14px;
        color: var(--text);
        background: rgba(255, 255, 255, 0.9);
      }

      input:focus {
        outline: 2px solid rgba(163, 71, 34, 0.18);
        border-color: var(--accent);
      }

      button {
        border: 0;
        border-radius: 999px;
        padding: 12px 16px;
        color: #fff7f0;
        background: var(--accent);
        cursor: pointer;
      }

      button:hover {
        background: var(--accent-strong);
      }

      .field {
        display: grid;
        gap: 8px;
      }

      .notice {
        margin-top: 18px;
        border-radius: 14px;
        padding: 12px 14px;
        color: var(--bad);
        background: rgba(141, 37, 31, 0.1);
      }
    </style>
  </head>
  <body>
    <main>
      <h1>后台登录</h1>
      <p>输入后台密码继续。</p>
      ${errorMarkup}
      <form action="${escapeHtml(config.basePath)}/login" method="post">
        <input type="hidden" name="next" value="${escapeHtml(options.nextPath)}" />
        <div class="field">
          <label for="password">后台密码</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required autofocus />
        </div>
        <button type="submit">登录</button>
      </form>
    </main>
  </body>
</html>`;
}
