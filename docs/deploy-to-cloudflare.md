# 部署到 Cloudflare

本文说明如何将本项目部署到 Cloudflare Pages，并确保鉴权、D1 绑定和 Pages Functions 能够按项目预期工作。

本项目不是纯静态站点。虽然页面本体由 Astro 生成静态输出，但访问控制依赖：

- `functions/_middleware.ts`
- `functions/auth/qr.ts`
- `functions/auth/logout.ts`
- D1 数据库绑定 `AUTH_DB`

因此，部署时必须同时保留：

- `dist/` 构建产物
- `functions/` 目录
- `wrangler.jsonc` 中的绑定和变量配置

如果只上传静态文件而没有让 Pages Functions 正常参与构建，鉴权链路就不会生效。

## 部署前提

请先确保具备以下条件：

- Cloudflare 账号
- 已安装并登录 Wrangler
- Node.js `>= 22.12.0`
- 仓库依赖已安装

### 安装依赖

```sh
npm install
```

### 登录 Wrangler

```sh
npx wrangler login
```

## 部署拓扑

本项目的生产形态如下：

- Astro 负责生成 `dist/`
- Cloudflare Pages 托管静态页面
- Cloudflare Pages Functions 负责请求拦截与登录流程
- Cloudflare D1 负责保存邀请码和 session

关键文件：

- `wrangler.jsonc`
  Pages 配置、D1 绑定、运行时变量
- `database/schema.sql`
  D1 表结构
- `functions/`
  鉴权链路入口

## 第一步：创建或确认 D1 数据库

如果已经有可用的 D1 数据库，可以直接复用。否则先创建一个新的数据库。

```sh
npx wrangler d1 create "lies-resumefoundry-auth"
```

创建完成后，请将返回结果中的真实值写入 `wrangler.jsonc`：

```json
"d1_databases": [
  {
    "binding": "AUTH_DB",
    "database_name": "lies-resumefoundry-auth",
    "database_id": "<实际数据库 ID>"
  }
]
```

注意：

- `binding` 必须保持为 `AUTH_DB`
- 代码中的 Functions 通过 `context.env.AUTH_DB` 访问数据库

## 第二步：初始化远程数据库结构

执行：

```sh
npx wrangler d1 execute "lies-resumefoundry-auth" --remote --file "database/schema.sql"
```

当前 schema 会创建两张核心表：

- `invite_tokens`
- `sessions`

用途：

- `invite_tokens`
  保存二维码邀请 token 的哈希、访问模式、使用次数和过期时间
- `sessions`
  保存服务端 session，用于支持会话吊销和退出登录

如果线上数据库结构过旧，建议直接按当前 `database/schema.sql` 重新初始化，而不是继续沿用历史表结构。

## 第三步：检查 `wrangler.jsonc`

当前项目依赖以下配置：

```json
{
  "name": "lies-resumefoundry",
  "compatibility_date": "2026-04-19",
  "pages_build_output_dir": "./dist",
  "d1_databases": [
    {
      "binding": "AUTH_DB",
      "database_name": "lies-resumefoundry-auth",
      "database_id": "<DATABASE_ID>"
    }
  ],
  "vars": {
    "AUTH_COOKIE_NAME": "resume_session",
    "AUTH_SESSION_TTL_SECONDS": "1209600",
    "AUTH_QR_DEFAULT_TTL_SECONDS": "900",
    "AUTH_PUBLIC_PATHS": "/unlock,/auth,/_astro,/favicon.ico,/favicon.svg"
  }
}
```

字段说明：

- `pages_build_output_dir`
  构建输出目录，必须与 Astro 构建产物一致，即 `dist`
- `d1_databases`
  声明 Pages Functions 需要的 D1 绑定
- `vars`
  运行时环境变量

### 推荐检查项

#### `AUTH_COOKIE_NAME`

默认值：

```text
resume_session
```

用途：

- 浏览器端 session cookie 的名称

#### `AUTH_SESSION_TTL_SECONDS`

默认值：

```text
1209600
```

即 14 天。

用途：

- 控制成功登录后 session 的默认有效期

#### `AUTH_QR_DEFAULT_TTL_SECONDS`

默认值：

```text
900
```

即 15 分钟。

用途：

- 发码脚本的默认邀请码有效期

#### `AUTH_PUBLIC_PATHS`

默认值：

```text
/unlock,/auth,/_astro,/favicon.ico,/favicon.svg
```

用途：

- 明确放行的公开路径
- 除这些路径和带扩展名的静态资源外，页面路径默认都需要 session

#### `AUTH_COOKIE_DOMAIN`

这是可选项。如果需要跨子域共享 cookie，可以通过环境变量单独配置；如无特殊需求，通常不需要设置。

## 第四步：本地验证构建产物

部署前建议先在本地完成一次完整构建：

```sh
npm run build
```

构建成功后，再用 Pages 本地运行时验证：

```sh
npx wrangler pages dev "dist" --port 8788 --ip 127.0.0.1
```

这样可以同时验证：

- `dist/` 是否生成成功
- `functions/` 是否被正确识别
- D1 绑定是否可用

## 第五步：选择部署方式

### 方案 A：Git 集成部署

这是最适合公开仓库的方式，也是最推荐的方案。

优点：

- 每次推送自动触发部署
- 便于保留部署历史
- 便于与预览分支和生产分支协同

推荐步骤：

1. 在 Cloudflare Dashboard 中创建 Pages 项目
2. 选择 Git 集成
3. 连接当前 GitHub 仓库
4. 设置：
   - Build command: `npm run build`
   - Build output directory: `dist`
5. 确认项目根目录为仓库根目录
6. 完成首次部署

对于 Git 集成部署，请确保：

- `functions/` 位于仓库根目录
- `wrangler.jsonc` 已提交到仓库
- D1 绑定和变量与 `wrangler.jsonc` 或 Dashboard 配置保持一致

### 方案 B：Wrangler 直接部署

如果希望从本地 CLI 手动发布，也可以使用 Wrangler。

#### 首次创建 Pages 项目

如果还没有创建过对应的 Pages 项目，可先执行：

```sh
npx wrangler pages project create
```

CLI 会提示输入：

- 项目名
- 生产分支

#### 部署构建产物

在仓库根目录执行：

```sh
npm run build
npx wrangler pages deploy "dist"
```

为什么必须在仓库根目录执行：

- Cloudflare Pages 在使用 Wrangler 部署时，会同时读取当前目录下的 `functions/`
- 如果从错误目录执行，`functions/` 可能不会被带上，导致鉴权失效

## 不推荐的部署方式

### 不要使用 Dashboard 的拖拽上传来部署本项目

原因很直接：

- 本项目依赖 `functions/` 目录
- Cloudflare 官方文档说明，Dashboard 的 drag-and-drop 部署当前不会编译 `functions` 目录

对本项目来说，这意味着：

- 页面会作为普通静态文件暴露
- `functions/_middleware.ts` 不会生效
- 鉴权入口链路会被绕过

因此，本项目只推荐：

- Git 集成部署
- `wrangler pages deploy`

## 第六步：部署后检查绑定与变量

无论使用哪种部署方式，都建议在 Cloudflare Dashboard 中打开 Pages 项目，确认：

- D1 绑定存在且名称为 `AUTH_DB`
- 变量值与 `wrangler.jsonc` 一致
- 如通过 Dashboard 手动调整过绑定或变量，已重新部署一次

如果绑定是在 Dashboard 中新增的，通常需要重新部署后才会生效。

## 第七步：部署后执行 smoke test

部署成功后，建议至少验证以下路径。

### 未登录访问应被拦截

访问以下路径时，预期应跳转到 `/unlock`：

- `/`
- `/print`
- `/index.html`
- `/resume/master`
- `/resume/ai-platform`
- `/resume/full-stack`
- `/2343`
- `/foo/bar`

说明：

- 项目当前采用“默认保护页面路径”的策略
- 非公开页面路径会被中间件统一要求 session

### 明确公开的路径应正常访问

以下路径应不触发鉴权跳转：

- `/unlock`
- `/auth/qr`
- `/favicon.svg`
- `/_astro/*`

## 第八步：生成一条线上测试邀请码

部署完成后，可用发码脚本生成一条实际访问链接：

```sh
npm run issue-qr -- \
  --base-url "https://<your-domain>" \
  --mode "single_use" \
  --ttl-minutes 15 \
  --next "/"
```

如果希望直接指向某份定制简历，可改为：

```sh
--next "/resume/ai-platform"
```

详见 [使用脚本生成二维码与邀请链接](./generate-qr-codes-and-links.md)。

## 缓存注意事项

本项目的受保护页面响应会通过中间件附加：

```text
Cache-Control: private, no-store
```

但仍然建议避免对 HTML 页面配置激进缓存规则。

建议：

- 仅缓存静态资源，例如 `/_astro/*`
- 不要对 `/`、`/print`、`/resume/*`、`/auth/*`、`/unlock` 配置会改变 HTML 缓存行为的规则

## 本地开发与生产部署的区别

### 仅用 `npm run dev`

这会启动 Astro 的本地开发服务器，适合调试页面和内容，但不适合完整验证：

- Pages Functions
- D1 绑定
- 鉴权中间件

### 使用 `wrangler pages dev`

这会更接近 Cloudflare Pages 实际运行方式，适合验证：

- 中间件拦截
- `/auth/qr`
- `/auth/logout`
- D1 本地绑定

因此，与上线有关的验证应优先基于：

```sh
npx wrangler pages dev "dist"
```

## 常见问题

### 线上首页直接公开，未跳转到 `/unlock`

优先检查：

1. 是否错误地使用了 drag-and-drop 部署
2. 部署时是否遗漏 `functions/`
3. 是否从错误目录执行了 `wrangler pages deploy`

### `/auth/qr` 报数据库相关错误

优先检查：

1. D1 绑定名称是否为 `AUTH_DB`
2. `database_id` 是否正确
3. 远程数据库是否执行过 `database/schema.sql`

### 本地能用，线上不能用

优先检查：

1. 本地是否用了 `--local`，而线上使用的是远程 D1
2. 线上 D1 是否已初始化
3. 线上 Pages 项目是否拿到了正确的绑定和变量

### 更新了 `wrangler.jsonc` 但线上没生效

Pages 项目的绑定和变量变更通常需要重新部署后才能生效。请确认已经触发一次新的部署。

## 建议的生产检查清单

上线前建议确认：

1. `wrangler.jsonc` 中的 D1 绑定已更新为真实值
2. 远程 D1 已执行 `database/schema.sql`
3. `npm run build` 成功
4. Pages 项目能识别 `functions/`
5. 未登录访问保护路径会跳转到 `/unlock`
6. 邀请码链路可以成功创建 session 并访问目标简历
7. `/auth/logout` 可以撤销当前 session

## 参考资料

以下是部署本项目时最相关的 Cloudflare 官方文档：

- Cloudflare Pages 直接上传：<https://developers.cloudflare.com/pages/get-started/direct-upload/>
- Cloudflare Pages Wrangler 配置：<https://developers.cloudflare.com/pages/functions/wrangler-configuration/>
- Cloudflare Pages 绑定：<https://developers.cloudflare.com/pages/functions/bindings/>
