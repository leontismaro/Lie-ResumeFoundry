import type { AdminConfig } from './config';
import type { AdminIdentity } from './access';
import type { AdminRouteOption } from '../../generated/admin-route-options';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderAdminPage(config: AdminConfig, identity: AdminIdentity, routeOptions: AdminRouteOption[]) {
  const basePath = JSON.stringify(config.basePath);
  const serializedRouteOptions = JSON.stringify(routeOptions);
  const actorEmail = escapeHtml(identity.email);
  const logoutFormMarkup =
    identity.authMethod === 'local'
      ? `<form action="${escapeHtml(config.basePath)}/logout" method="post">
              <button class="ghost" type="submit">退出</button>
            </form>`
      : '';
  const authLabel = escapeHtml(
    config.authMode === 'access'
      ? 'Cloudflare Access'
      : config.authMode === 'access_with_local_fallback'
        ? 'Access / 后台密码'
        : '后台密码',
  );
  const routeOptionsMarkup = routeOptions
    .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
    .join('');

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow,noarchive,nosnippet" />
    <title>后台短码管理</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5efe4;
        --panel: rgba(255, 250, 242, 0.94);
        --panel-strong: #fff8ef;
        --line: rgba(93, 62, 31, 0.16);
        --text: #2d2217;
        --muted: #75614d;
        --accent: #a34722;
        --accent-strong: #7f3516;
        --good: #1f6a4d;
        --warn: #9b5c05;
        --bad: #8d251f;
        --shadow: 0 18px 48px rgba(70, 38, 12, 0.12);
        --radius: 22px;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: "IBM Plex Sans", "Noto Sans SC", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(183, 110, 42, 0.18), transparent 32%),
          radial-gradient(circle at top right, rgba(117, 97, 77, 0.14), transparent 26%),
          linear-gradient(180deg, #f8f2e8 0%, #efe5d5 100%);
        min-height: 100vh;
      }

      .shell {
        width: min(1460px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 28px 0 48px;
      }

      .hero, .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        backdrop-filter: blur(14px);
      }

      .hero {
        padding: 28px;
        display: grid;
        gap: 18px;
      }

      .hero-top {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: start;
      }

      .hero h1 {
        margin: 0;
        font-family: "IBM Plex Serif", "Source Han Serif SC", serif;
        font-size: clamp(2rem, 3vw, 3rem);
        line-height: 1;
      }

      .muted {
        color: var(--muted);
      }

      .admin-session {
        display: grid;
        gap: 10px;
        justify-items: end;
        text-align: right;
      }

      .summary-grid, .workspace {
        display: grid;
        gap: 18px;
      }

      .summary-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .summary-card {
        padding: 16px 18px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.58);
        border: 1px solid rgba(93, 62, 31, 0.1);
      }

      .summary-card strong {
        display: block;
        margin-top: 8px;
        font-size: 1.8rem;
      }

      .workspace {
        grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
        margin-top: 18px;
      }

      .panel {
        padding: 22px;
      }

      .panel h2 {
        margin: 0 0 14px;
        font-size: 1.15rem;
      }

      .field {
        display: grid;
        gap: 8px;
        margin-bottom: 14px;
      }

      .field-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .field-stack {
        display: grid;
        gap: 8px;
      }

      label {
        font-size: 0.92rem;
        color: var(--muted);
      }

      input,
      select,
      textarea,
      button {
        font: inherit;
      }

      input,
      select,
      textarea {
        width: 100%;
        border: 1px solid rgba(93, 62, 31, 0.14);
        border-radius: 14px;
        padding: 12px 14px;
        background: rgba(255, 255, 255, 0.88);
        color: var(--text);
      }

      input[readonly] {
        background: rgba(239, 229, 213, 0.35);
        color: var(--muted);
      }

      textarea {
        min-height: 96px;
        resize: vertical;
      }

      button {
        border: 0;
        border-radius: 999px;
        padding: 11px 16px;
        background: var(--accent);
        color: #fff7f0;
        cursor: pointer;
        transition: transform 120ms ease, background 120ms ease;
        white-space: nowrap;
      }

      button:hover {
        background: var(--accent-strong);
        transform: translateY(-1px);
      }

      button.secondary {
        background: rgba(122, 73, 26, 0.1);
        color: var(--text);
      }

      button.secondary:hover {
        background: rgba(122, 73, 26, 0.18);
      }

      button.ghost {
        background: transparent;
        color: var(--muted);
        border: 1px solid rgba(93, 62, 31, 0.14);
      }

      button.danger {
        background: rgba(141, 37, 31, 0.9);
        color: #fff7f0;
      }

      button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
        transform: none;
      }

      .toolbar {
        display: flex;
        gap: 12px;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
        min-width: 0;
      }

      .toolbar-group {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: nowrap;
        white-space: nowrap;
        margin-left: auto;
        min-width: 0;
        flex: 0 1 auto;
      }

      .toolbar-group select,
      .toolbar-group button {
        flex: 0 0 auto;
      }

      .toolbar h2 {
        min-width: 0;
        flex: 1 1 auto;
      }

      .toolbar-group select {
        width: auto;
        min-width: 140px;
        max-width: 100%;
      }

      .toolbar-group button {
        min-width: 72px;
        padding-inline: 14px;
      }

      .result-card {
        display: grid;
        gap: 14px;
        padding: 16px;
        border-radius: 18px;
        background: var(--panel-strong);
        border: 1px solid rgba(93, 62, 31, 0.1);
      }

      .result-card pre {
        margin: 0;
        padding: 12px 14px;
        border-radius: 14px;
        overflow: auto;
        background: #2d2217;
        color: #f8f2e8;
      }

      .result-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 0.82rem;
      }

      .status-active {
        background: rgba(31, 106, 77, 0.12);
        color: var(--good);
      }

      .status-disabled {
        background: rgba(141, 37, 31, 0.12);
        color: var(--bad);
      }

      .status-expired,
      .status-used_up {
        background: rgba(155, 92, 5, 0.12);
        color: var(--warn);
      }

      .table-shell {
        overflow: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      .token-table {
        min-width: 1280px;
      }

      th,
      td {
        padding: 14px 10px;
        text-align: left;
        border-bottom: 1px solid rgba(93, 62, 31, 0.12);
        vertical-align: top;
      }

      th {
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--muted);
      }

      td code {
        font-size: 0.88rem;
        background: rgba(122, 73, 26, 0.08);
        padding: 2px 6px;
        border-radius: 8px;
      }

      .token-table th:nth-child(1),
      .token-table td:nth-child(1) {
        width: 27%;
      }

      .token-table th:nth-child(2),
      .token-table td:nth-child(2) {
        width: 20%;
      }

      .token-table th:nth-child(3),
      .token-table td:nth-child(3) {
        width: 10%;
      }

      .token-table th:nth-child(4),
      .token-table td:nth-child(4) {
        width: 14%;
      }

      .token-table th:nth-child(5),
      .token-table td:nth-child(5) {
        width: 15%;
      }

      .token-table th:nth-child(6),
      .token-table td:nth-child(6) {
        width: 14%;
      }

      .cell-title {
        font-weight: 700;
        margin-bottom: 6px;
      }

      .cell-stack {
        display: grid;
        gap: 6px;
        min-width: 0;
      }

      .cell-line {
        line-height: 1.55;
      }

      .route-chip {
        display: inline-flex;
        align-items: center;
        max-width: 100%;
        padding: 3px 8px;
        border-radius: 999px;
        background: rgba(122, 73, 26, 0.08);
        color: var(--muted);
        font-size: 0.84rem;
        white-space: nowrap;
      }

      .path-text {
        color: var(--muted);
        font-size: 0.88rem;
        overflow-wrap: anywhere;
      }

      .nowrap {
        white-space: nowrap;
      }

      .session-text {
        line-height: 1.45;
      }

      .action-group {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .empty {
        padding: 24px 0 8px;
        color: var(--muted);
      }

      .flash {
        min-height: 24px;
        font-size: 0.92rem;
      }

      .flash[data-tone='error'] {
        color: var(--bad);
      }

      .flash[data-tone='success'] {
        color: var(--good);
      }

      .modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 40;
        display: grid;
        place-items: center;
        padding: 20px;
        background: rgba(45, 34, 23, 0.34);
        backdrop-filter: blur(8px);
      }

      .modal {
        width: min(560px, 100%);
        background: rgba(255, 250, 242, 0.98);
        border: 1px solid rgba(93, 62, 31, 0.14);
        border-radius: 24px;
        box-shadow: 0 28px 70px rgba(45, 34, 23, 0.24);
        padding: 22px;
      }

      .modal-head {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
      }

      .modal-head h3 {
        margin: 0 0 6px;
        font-size: 1.2rem;
      }

      .modal-close {
        min-width: 44px;
        padding: 10px 12px;
      }

      .modal-summary {
        padding: 14px 16px;
        border-radius: 18px;
        background: rgba(122, 73, 26, 0.08);
        border: 1px solid rgba(93, 62, 31, 0.1);
        line-height: 1.65;
      }

      .modal-summary strong {
        display: block;
        margin-bottom: 8px;
      }

      .modal-error {
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(141, 37, 31, 0.08);
        color: var(--bad);
        line-height: 1.55;
      }

      .checkbox-row {
        display: flex;
        align-items: start;
        gap: 10px;
        font-size: 0.92rem;
        color: var(--muted);
      }

      .checkbox-row input {
        width: auto;
        margin-top: 2px;
      }

      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 8px;
      }

      [hidden] {
        display: none !important;
      }

      @media (max-width: 960px) {
        .summary-grid,
        .workspace,
        .field-row {
          grid-template-columns: 1fr;
        }

        .hero-top,
        .toolbar {
          flex-direction: column;
          align-items: stretch;
        }

        .admin-session {
          justify-items: start;
          text-align: left;
        }

        .shell {
          width: min(100vw - 20px, 1460px);
        }

        .toolbar-group {
          justify-content: flex-start;
          overflow-x: auto;
          width: 100%;
          margin-left: 0;
        }

        table,
        thead,
        tbody,
        tr,
        th,
        td {
          display: block;
        }

        thead {
          display: none;
        }

        tr {
          border-bottom: 1px solid rgba(93, 62, 31, 0.12);
          padding: 10px 0;
        }

        td {
          border: 0;
          padding: 8px 0;
        }

        td::before {
          content: attr(data-label);
          display: block;
          font-size: 0.78rem;
          color: var(--muted);
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <div class="hero-top">
          <div>
            <p class="muted">${authLabel}</p>
            <h1>二维码 / 短码管理台</h1>
            <p class="muted">新短码只展示一次，请及时保存。</p>
          </div>
          <div class="admin-session">
            <div class="muted">当前管理员：${actorEmail}</div>
            ${logoutFormMarkup}
          </div>
        </div>

        <div class="summary-grid" id="summaryGrid">
          <div class="summary-card"><span class="muted">总数</span><strong>0</strong></div>
          <div class="summary-card"><span class="muted">生效中</span><strong>0</strong></div>
          <div class="summary-card"><span class="muted">即将过期</span><strong>0</strong></div>
          <div class="summary-card"><span class="muted">已禁用 / 已用尽</span><strong>0</strong></div>
        </div>
      </section>

      <section class="workspace">
        <section class="panel">
          <h2>新建短码</h2>
          <form id="createForm">
            <div class="field">
              <label for="nextPath">目标路径</label>
              <select id="nextPath" name="nextPath">
                ${routeOptionsMarkup}
              </select>
            </div>

            <div class="field">
              <label for="note">备注</label>
              <textarea id="note" name="note" placeholder="例如：AI 平台岗位一面，发给张三"></textarea>
            </div>

            <div class="field-row">
              <div class="field">
                <label for="mode">模式</label>
                <select id="mode" name="mode">
                  <option value="single_use">一次性</option>
                  <option value="reusable_until_expire">有效期内可重复使用</option>
                  <option value="limited_uses">限制使用次数</option>
                </select>
              </div>

              <div class="field" id="maxUsesField" hidden>
                <label for="maxUses">最大使用次数</label>
                <input id="maxUses" name="maxUses" type="number" min="1" placeholder="限次模式必填" />
              </div>
            </div>

            <div class="field-row">
              <div class="field">
                <label for="ttlPreset">短码有效期</label>
                <div class="field-stack">
                  <select id="ttlPreset" name="ttlPreset">
                    <option value="15">15 分钟</option>
                    <option value="60">1 小时</option>
                    <option value="1440">1 天</option>
                    <option value="10080">7 天</option>
                    <option value="43200">30 天</option>
                    <option value="custom">自定义</option>
                  </select>
                  <input id="ttlMinutes" name="ttlMinutes" type="number" min="1" value="15" required />
                </div>
              </div>

              <div class="field">
                <label for="sessionTtlPreset">Session 有效期</label>
                <div class="field-stack">
                  <select id="sessionTtlPreset" name="sessionTtlPreset">
                    <option value="60">1 小时</option>
                    <option value="1440">1 天</option>
                    <option value="10080">7 天</option>
                    <option value="20160" selected>14 天</option>
                    <option value="43200">30 天</option>
                    <option value="custom">自定义</option>
                  </select>
                  <input id="sessionTtlMinutes" name="sessionTtlMinutes" type="number" min="1" value="20160" required />
                </div>
              </div>
            </div>

            <div class="field">
              <label for="sessionPolicy">Session 策略</label>
              <select id="sessionPolicy" name="sessionPolicy">
                <option value="fixed_ttl">固定会话时长</option>
                <option value="cap_to_invite_expiry">会话时长不超过邀请码剩余有效期</option>
              </select>
            </div>

            <button type="submit">生成短码</button>
          </form>
        </section>

        <section class="panel">
          <div class="toolbar">
            <h2>生成结果</h2>
            <div class="flash" id="flash"></div>
          </div>
          <div class="result-card" id="resultCard">
            <p class="muted">创建成功后，这里会显示一次性明文短码、解锁链接和二维码预览。</p>
          </div>
        </section>
      </section>

      <section class="panel" style="margin-top: 18px;">
        <div class="toolbar">
          <h2>短码列表</h2>
          <div class="toolbar-group">
            <select id="statusFilter">
              <option value="all">全部状态</option>
              <option value="active">生效中</option>
              <option value="disabled">已禁用</option>
              <option value="expired">已过期</option>
              <option value="used_up">已用尽</option>
            </select>
            <button class="secondary" id="refreshButton" type="button">刷新</button>
          </div>
        </div>

        <div class="table-shell">
          <table class="token-table">
            <thead>
              <tr>
                <th>备注 / 路径</th>
                <th>模式 / 使用</th>
                <th>状态</th>
                <th>过期时间</th>
                <th>创建信息</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody id="tokenRows"></tbody>
          </table>
        </div>
        <div class="empty" id="emptyState" hidden>当前没有符合条件的短码。</div>
      </section>
    </main>

    <div class="modal-backdrop" id="modalBackdrop" hidden>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="modal-head">
          <div>
            <h3 id="modalTitle">操作</h3>
            <p class="muted" id="modalSubtitle"></p>
          </div>
          <button class="ghost modal-close" id="modalCloseButton" type="button">关闭</button>
        </div>

        <form id="modalForm">
          <div class="modal-summary" id="modalSummary"></div>

          <div class="field" id="modalReasonField" hidden>
            <label for="modalReason">禁用原因</label>
            <textarea id="modalReason" placeholder="可选，便于后台追踪"></textarea>
          </div>

          <div class="field" id="modalRevokeField" hidden>
            <label class="checkbox-row" for="modalRevokeSessions">
              <input id="modalRevokeSessions" type="checkbox" />
              <span>同时吊销该短码已创建的所有 session</span>
            </label>
          </div>

          <div class="field" id="modalExtendField" hidden>
            <label for="modalExtendPreset">延长有效期</label>
            <div class="field-stack">
              <select id="modalExtendPreset">
                <option value="1440">1 天</option>
                <option value="10080" selected>7 天</option>
                <option value="43200">30 天</option>
                <option value="custom">自定义</option>
              </select>
              <input id="modalExtendMinutes" type="number" min="1" value="10080" />
            </div>
          </div>

          <div class="field" id="modalAddUsesField" hidden>
            <label for="modalAddUses">增加可用次数</label>
            <input id="modalAddUses" type="number" min="1" value="1" />
          </div>

          <div class="modal-error" id="modalError" hidden></div>

          <div class="modal-actions">
            <button class="ghost" id="modalCancelButton" type="button">取消</button>
            <button id="modalConfirmButton" type="submit">确认</button>
          </div>
        </form>
      </div>
    </div>

    <script>
      const ADMIN_BASE_PATH = ${basePath};
      const ROUTE_OPTIONS = ${serializedRouteOptions};

      const createForm = document.getElementById('createForm');
      const resultCard = document.getElementById('resultCard');
      const tokenRows = document.getElementById('tokenRows');
      const flash = document.getElementById('flash');
      const refreshButton = document.getElementById('refreshButton');
      const statusFilter = document.getElementById('statusFilter');
      const emptyState = document.getElementById('emptyState');
      const maxUsesField = document.getElementById('maxUsesField');
      const maxUsesInput = document.getElementById('maxUses');
      const modeSelect = document.getElementById('mode');
      const nextPathSelect = document.getElementById('nextPath');
      const ttlPresetSelect = document.getElementById('ttlPreset');
      const ttlMinutesInput = document.getElementById('ttlMinutes');
      const sessionTtlPresetSelect = document.getElementById('sessionTtlPreset');
      const sessionTtlMinutesInput = document.getElementById('sessionTtlMinutes');
      const summaryGrid = document.getElementById('summaryGrid');

      const modalBackdrop = document.getElementById('modalBackdrop');
      const modalForm = document.getElementById('modalForm');
      const modalTitle = document.getElementById('modalTitle');
      const modalSubtitle = document.getElementById('modalSubtitle');
      const modalSummary = document.getElementById('modalSummary');
      const modalReasonField = document.getElementById('modalReasonField');
      const modalReason = document.getElementById('modalReason');
      const modalRevokeField = document.getElementById('modalRevokeField');
      const modalRevokeSessions = document.getElementById('modalRevokeSessions');
      const modalExtendField = document.getElementById('modalExtendField');
      const modalExtendPreset = document.getElementById('modalExtendPreset');
      const modalExtendMinutes = document.getElementById('modalExtendMinutes');
      const modalAddUsesField = document.getElementById('modalAddUsesField');
      const modalAddUses = document.getElementById('modalAddUses');
      const modalError = document.getElementById('modalError');
      const modalConfirmButton = document.getElementById('modalConfirmButton');
      const modalCancelButton = document.getElementById('modalCancelButton');
      const modalCloseButton = document.getElementById('modalCloseButton');

      const modalState = {
        action: '',
        item: null,
      };

      let loadedItems = [];

      function translateMode(mode) {
        if (mode === 'single_use') {
          return '一次性';
        }

        if (mode === 'reusable_until_expire') {
          return '有效期内可重复使用';
        }

        if (mode === 'limited_uses') {
          return '限制使用次数';
        }

        return mode;
      }

      function translateSessionPolicy(policy) {
        if (policy === 'fixed_ttl') {
          return '固定会话时长';
        }

        if (policy === 'cap_to_invite_expiry') {
          return '会话时长不超过邀请码剩余有效期';
        }

        return policy;
      }

      function isExpired(item) {
        return item.expiresAt <= Math.floor(Date.now() / 1000);
      }

      function isSingleUseConsumed(item) {
        return item.mode === 'single_use' && item.usedCount > 0;
      }

      function hasRemainingUses(item) {
        if (item.mode !== 'limited_uses') {
          return true;
        }

        if (!item.maxUses) {
          return false;
        }

        return item.usedCount < item.maxUses;
      }

      function canEnable(item) {
        if (!item.disabledAt) {
          return false;
        }

        if (isExpired(item)) {
          return false;
        }

        if (isSingleUseConsumed(item)) {
          return false;
        }

        if (item.mode === 'limited_uses' && !hasRemainingUses(item)) {
          return false;
        }

        return true;
      }

      function canDisable(item) {
        return !item.disabledAt;
      }

      function canExtend(item) {
        return !isSingleUseConsumed(item);
      }

      function canAddUses(item) {
        return item.mode === 'limited_uses';
      }

      function translateStatus(status, item) {
        if (status === 'active') {
          return '生效中';
        }

        if (status === 'disabled') {
          return '已禁用';
        }

        if (status === 'expired') {
          return '已过期';
        }

        if (status === 'used_up') {
          return item && item.mode === 'single_use' ? '已使用' : '次数已用尽';
        }

        return status;
      }

      function getRouteLabel(path) {
        const match = ROUTE_OPTIONS.find(function(option) {
          return option.value === path;
        });

        return match ? match.label : path;
      }

      function getInviteById(inviteId) {
        return loadedItems.find(function(item) {
          return item.id === inviteId;
        }) || null;
      }

      function syncModeFields() {
        const isLimitedUses = modeSelect.value === 'limited_uses';
        maxUsesField.hidden = !isLimitedUses;
        maxUsesInput.required = isLimitedUses;

        if (!isLimitedUses) {
          maxUsesInput.value = '';
        }
      }

      function syncPresetInput(selectElement, inputElement) {
        const presetValue = selectElement.value;
        const isCustom = presetValue === 'custom';
        inputElement.readOnly = !isCustom;

        if (!isCustom) {
          inputElement.value = presetValue;
        }
      }

      function setFlash(message, tone) {
        flash.textContent = message || '';
        flash.dataset.tone = tone || '';
      }

      function setModalError(message) {
        modalError.textContent = message || '';
        modalError.hidden = !message;
      }

      function formatDateTime(value) {
        return new Intl.DateTimeFormat('zh-CN', {
          dateStyle: 'medium',
          timeStyle: 'short',
          hour12: false,
          timeZone: 'Asia/Shanghai',
        }).format(new Date(value * 1000));
      }

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function buildStatusBadge(status, item) {
        return '<span class="status status-' + status + '">' + escapeHtml(translateStatus(status, item)) + '</span>';
      }

      function renderSummary(summary) {
        const disabledTotal = (summary.disabled || 0) + (summary.usedUp || 0);
        summaryGrid.innerHTML = [
          ['总数', summary.total || 0],
          ['生效中', summary.active || 0],
          ['即将过期', summary.expiringSoon || 0],
          ['已禁用 / 已用尽', disabledTotal],
        ].map(function(entry) {
          return '<div class="summary-card"><span class="muted">' + entry[0] + '</span><strong>' + entry[1] + '</strong></div>';
        }).join('');
      }

      function renderRows(items) {
        tokenRows.innerHTML = '';

        if (!items.length) {
          emptyState.hidden = false;
          return;
        }

        emptyState.hidden = true;

        tokenRows.innerHTML = items.map(function(item) {
          const maxUses = item.maxUses ? ' / ' + item.maxUses : '';
          const disabledReason = item.disabledReason
            ? '<div class="muted">禁用原因：' + escapeHtml(item.disabledReason) + '</div>'
            : '';
          const actionButtons = [];

          if (canEnable(item)) {
            actionButtons.push('<button class="secondary" data-action="enable" data-id="' + escapeHtml(item.id) + '">启用</button>');
          }

          if (canExtend(item)) {
            actionButtons.push('<button class="secondary" data-action="extend" data-id="' + escapeHtml(item.id) + '">延长有效期</button>');
          }

          if (canAddUses(item)) {
            actionButtons.push('<button class="secondary" data-action="add-uses" data-id="' + escapeHtml(item.id) + '">增加次数</button>');
          }

          if (canDisable(item)) {
            actionButtons.push('<button class="ghost" data-action="disable" data-id="' + escapeHtml(item.id) + '">禁用</button>');
          }

          return '<tr>' +
            '<td data-label="备注 / 路径"><div class="cell-stack"><div class="cell-title">' + escapeHtml(item.note || '未备注') + '</div><div class="route-chip">' + escapeHtml(getRouteLabel(item.nextPath)) + '</div><div class="path-text">' + escapeHtml(item.nextPath) + '</div>' + disabledReason + '</div></td>' +
            '<td data-label="模式 / 使用"><div class="cell-stack"><div class="nowrap"><code>' + escapeHtml(translateMode(item.mode)) + '</code></div><div class="cell-line muted">已使用：' + item.usedCount + maxUses + '</div><div class="cell-line muted session-text">Session：' + escapeHtml(translateSessionPolicy(item.sessionPolicy)) + '</div></div></td>' +
            '<td data-label="状态">' + buildStatusBadge(item.status, item) + '</td>' +
            '<td data-label="过期时间"><div class="cell-stack"><div class="nowrap">' + escapeHtml(formatDateTime(item.expiresAt)) + '</div></div></td>' +
            '<td data-label="创建信息"><div class="cell-stack"><div class="path-text">' + escapeHtml(item.createdBy || '未知') + '</div><div class="muted nowrap">' + escapeHtml(formatDateTime(item.createdAt)) + '</div></div></td>' +
            '<td data-label="操作"><div class="action-group">' + actionButtons.join('') + '</div></td>' +
          '</tr>';
        }).join('');
      }

      async function loadTokens() {
        setFlash('正在加载短码列表...', '');
        const response = await fetch(ADMIN_BASE_PATH + '/api/tokens', {
          headers: { Accept: 'application/json' },
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || '加载短码失败');
        }

        loadedItems = payload.items || [];

        const status = statusFilter.value;
        const items = status === 'all'
          ? loadedItems
          : loadedItems.filter(function(item) {
              return item.status === status;
            });

        renderSummary(payload.summary);
        renderRows(items);
        setFlash('列表已更新', 'success');
      }

      function renderCreateResult(payload) {
        const qrSvg = payload.qrSvg || '';
        resultCard.innerHTML = [
          '<div><strong>访问短码</strong><pre>' + escapeHtml(payload.token) + '</pre></div>',
          '<div><strong>解锁链接</strong><pre>' + escapeHtml(payload.unlockUrl) + '</pre></div>',
          '<div class="result-actions">' +
            '<button class="secondary" type="button" id="copyTokenButton">复制短码</button>' +
            '<button class="secondary" type="button" id="copyLinkButton">复制链接</button>' +
            '<button class="secondary" type="button" id="downloadQrButton">下载 SVG</button>' +
          '</div>',
          '<div><strong>二维码预览</strong><div>' + qrSvg + '</div></div>',
        ].join('');

        document.getElementById('copyTokenButton').addEventListener('click', function() {
          navigator.clipboard.writeText(payload.token);
        });

        document.getElementById('copyLinkButton').addEventListener('click', function() {
          navigator.clipboard.writeText(payload.unlockUrl);
        });

        document.getElementById('downloadQrButton').addEventListener('click', function() {
          const blob = new Blob([payload.qrSvg], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'invite-' + payload.item.id + '.svg';
          link.click();
          URL.revokeObjectURL(url);
        });
      }

      function resetModalFields() {
        modalReasonField.hidden = true;
        modalRevokeField.hidden = true;
        modalExtendField.hidden = true;
        modalAddUsesField.hidden = true;
        modalReason.value = '';
        modalRevokeSessions.checked = false;
        modalExtendPreset.value = '10080';
        modalExtendMinutes.value = '10080';
        modalAddUses.value = '1';
        syncPresetInput(modalExtendPreset, modalExtendMinutes);
        setModalError('');
      }

      function buildModalSummary(item) {
        const lines = [
          '<strong>' + escapeHtml(item.note || '未备注') + '</strong>',
          '目标路径：' + escapeHtml(getRouteLabel(item.nextPath)) + '（' + escapeHtml(item.nextPath) + '）',
          '模式：' + escapeHtml(translateMode(item.mode)),
          '当前状态：' + escapeHtml(translateStatus(item.status, item)),
          '过期时间：' + escapeHtml(formatDateTime(item.expiresAt)),
          '已使用：' + item.usedCount + (item.maxUses ? ' / ' + item.maxUses : ''),
        ];

        return lines.join('<br />');
      }

      function openModal(action, item) {
        modalState.action = action;
        modalState.item = item;
        resetModalFields();
        modalSummary.innerHTML = buildModalSummary(item);

        if (action === 'disable') {
          modalTitle.textContent = '禁用短码';
          modalSubtitle.textContent = '禁用后，该短码将无法继续兑换新的 session。';
          modalReasonField.hidden = false;
          modalRevokeField.hidden = false;
          modalConfirmButton.textContent = '确认禁用';
          modalConfirmButton.className = 'danger';
        }

        if (action === 'extend') {
          modalTitle.textContent = '延长有效期';
          modalSubtitle.textContent = '只调整短码的过期时间，不影响已有 session。';
          modalExtendField.hidden = false;
          modalConfirmButton.textContent = '确认延长';
          modalConfirmButton.className = '';
        }

        if (action === 'add-uses') {
          modalTitle.textContent = '增加可用次数';
          modalSubtitle.textContent = '只调整次数上限，不会影响已发放 session。';
          modalAddUsesField.hidden = false;
          modalConfirmButton.textContent = '确认增加';
          modalConfirmButton.className = '';
        }

        if (action === 'enable') {
          modalTitle.textContent = '启用短码';
          modalSubtitle.textContent = '启用后，该短码可以再次兑换新的 session。';
          modalConfirmButton.textContent = '确认启用';
          modalConfirmButton.className = '';
        }

        modalBackdrop.hidden = false;
      }

      function closeModal() {
        modalBackdrop.hidden = true;
        modalState.action = '';
        modalState.item = null;
        modalConfirmButton.disabled = false;
        resetModalFields();
      }

      async function submitModalAction() {
        if (!modalState.action || !modalState.item) {
          return;
        }

        modalConfirmButton.disabled = true;
        setModalError('');

        let endpoint = '';
        let payload = null;
        let successMessage = '';

        if (modalState.action === 'disable') {
          endpoint = '/disable';
          payload = {
            reason: modalReason.value.trim(),
            revokeSessions: modalRevokeSessions.checked,
          };
          successMessage = '短码已禁用';
        }

        if (modalState.action === 'extend') {
          const extendMinutes = Number(modalExtendMinutes.value);
          if (!Number.isFinite(extendMinutes) || extendMinutes <= 0) {
            modalConfirmButton.disabled = false;
            setModalError('请输入有效的延长分钟数。');
            return;
          }

          endpoint = '/extend';
          payload = {
            extendMinutes: Math.floor(extendMinutes),
          };
          successMessage = '短码已延长';
        }

        if (modalState.action === 'add-uses') {
          const additionalUses = Number(modalAddUses.value);
          if (!Number.isFinite(additionalUses) || additionalUses <= 0) {
            modalConfirmButton.disabled = false;
            setModalError('请输入有效的增加次数。');
            return;
          }

          endpoint = '/add-uses';
          payload = {
            additionalUses: Math.floor(additionalUses),
          };
          successMessage = '短码可用次数已增加';
        }

        if (modalState.action === 'enable') {
          endpoint = '/enable';
          payload = {};
          successMessage = '短码已启用';
        }

        const response = await fetch(ADMIN_BASE_PATH + '/api/tokens/' + modalState.item.id + endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const result = await response.json();

        modalConfirmButton.disabled = false;

        if (!response.ok) {
          setModalError(result.error || '操作失败');
          return;
        }

        closeModal();
        setFlash(successMessage, 'success');
        await loadTokens();
      }

      createForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        setFlash('正在生成短码...', '');
        const formData = new FormData(createForm);
        const payload = {
          maxUses: formData.get('maxUses') ? Number(formData.get('maxUses')) : null,
          mode: String(formData.get('mode') || 'single_use'),
          nextPath: String(formData.get('nextPath') || '/'),
          note: String(formData.get('note') || ''),
          sessionPolicy: String(formData.get('sessionPolicy') || 'fixed_ttl'),
          sessionTtlMinutes: Number(formData.get('sessionTtlMinutes') || 20160),
          ttlMinutes: Number(formData.get('ttlMinutes') || 15),
        };

        const response = await fetch(ADMIN_BASE_PATH + '/api/tokens', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const result = await response.json();

        if (!response.ok) {
          setFlash(result.error || '生成短码失败', 'error');
          return;
        }

        renderCreateResult(result);
        setFlash('短码已创建，明文只展示这一次。', 'success');
        await loadTokens();
      });

      tokenRows.addEventListener('click', function(event) {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement)) {
          return;
        }

        const action = target.dataset.action;
        const inviteId = target.dataset.id;
        if (!action || !inviteId) {
          return;
        }

        const item = getInviteById(inviteId);
        if (!item) {
          setFlash('未找到对应短码，请先刷新列表。', 'error');
          return;
        }

        openModal(action, item);
      });

      modalForm.addEventListener('submit', function(event) {
        event.preventDefault();
        submitModalAction().catch(function(error) {
          modalConfirmButton.disabled = false;
          setModalError(error instanceof Error ? error.message : '操作失败');
        });
      });

      modalCancelButton.addEventListener('click', closeModal);
      modalCloseButton.addEventListener('click', closeModal);

      modalBackdrop.addEventListener('click', function(event) {
        if (event.target === modalBackdrop) {
          closeModal();
        }
      });

      document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && !modalBackdrop.hidden) {
          closeModal();
        }
      });

      refreshButton.addEventListener('click', function() {
        loadTokens().catch(function(error) {
          setFlash(error instanceof Error ? error.message : '刷新失败', 'error');
        });
      });

      statusFilter.addEventListener('change', function() {
        loadTokens().catch(function(error) {
          setFlash(error instanceof Error ? error.message : '筛选失败', 'error');
        });
      });

      modeSelect.addEventListener('change', syncModeFields);
      ttlPresetSelect.addEventListener('change', function() {
        syncPresetInput(ttlPresetSelect, ttlMinutesInput);
      });
      sessionTtlPresetSelect.addEventListener('change', function() {
        syncPresetInput(sessionTtlPresetSelect, sessionTtlMinutesInput);
      });
      modalExtendPreset.addEventListener('change', function() {
        syncPresetInput(modalExtendPreset, modalExtendMinutes);
      });

      nextPathSelect.value = '/';
      syncModeFields();
      syncPresetInput(ttlPresetSelect, ttlMinutesInput);
      syncPresetInput(sessionTtlPresetSelect, sessionTtlMinutesInput);
      syncPresetInput(modalExtendPreset, modalExtendMinutes);

      loadTokens().catch(function(error) {
        setFlash(error instanceof Error ? error.message : '初始化失败', 'error');
      });
    </script>
  </body>
</html>`;
}
