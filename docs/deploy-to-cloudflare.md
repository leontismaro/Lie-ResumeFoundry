# 部署到 Cloudflare

本文说明如何将项目部署到 Cloudflare Pages，并确保以下能力按预期生效：

- 简历页面受 session 控制访问
- `/auth/qr` 与 `/auth/logout` 正常工作
- D1 可用于短码、session 与限流状态存储
- 后台控制台由后台密码或 Cloudflare Access 保护

## 部署模型

项目的生产形态如下：

- Astro 生成 `dist/`
- Cloudflare Pages 托管静态页面
- Cloudflare Pages Functions 负责访问拦截、短码校验与后台接口
- Cloudflare D1 保存 `invite_tokens`、`sessions` 与 `auth_rate_limits`
- 后台默认使用本项目中间件与独立后台密码 cookie
- Cloudflare Access 可作为后台入口认证增强

因此，部署时必须同时保留：

- `dist/` 构建产物
- `functions/` 目录
- `wrangler.jsonc` 中的绑定与变量配置

如果仅上传静态文件而未让 Pages Functions 参与部署，鉴权与后台能力均不会生效。

## 部署前提

- Cloudflare 账号
- Node.js `>= 22.12.0`
- 已安装依赖：`npm install`
- 已登录 Wrangler：`npx wrangler login`

## 第一步：创建 D1 数据库

执行：

```sh
npx wrangler d1 create "lies-resumefoundry-auth"
```

创建完成后，将返回的数据库 ID 写入 `wrangler.jsonc`：

```json
"d1_databases": [
  {
    "binding": "AUTH_DB",
    "database_name": "lies-resumefoundry-auth",
    "database_id": "<DATABASE_ID>"
  }
]
```

要求：

- `binding` 必须保持为 `AUTH_DB`
- Pages Functions 通过 `context.env.AUTH_DB` 访问数据库

## 第二步：初始化数据库结构

首次部署直接执行完整 schema：

```sh
npx wrangler d1 execute "lies-resumefoundry-auth" --remote --file "database/schema.sql"
```

该 schema 会创建三张核心表：

- `invite_tokens`
- `sessions`
- `auth_rate_limits`

其中：

- `invite_tokens`
  保存短码哈希、跳转路径、模式、过期时间、使用次数与后台管理字段
- `sessions`
  保存服务端 session
- `auth_rate_limits`
  保存 `/auth/qr` 的失败验证限流状态

## 第三步：配置运行时变量

项目依赖的关键变量如下：

```json
{
  "AUTH_COOKIE_NAME": "resume_session",
  "AUTH_SESSION_TTL_SECONDS": "1209600",
  "AUTH_QR_DEFAULT_TTL_SECONDS": "900",
  "AUTH_QR_RATE_LIMIT_MAX_ATTEMPTS": "8",
  "AUTH_QR_RATE_LIMIT_WINDOW_SECONDS": "600",
  "AUTH_PUBLIC_PATHS": "/unlock,/auth/qr,/auth/logout,/_astro/*,/favicon.ico,/favicon.svg",
  "ADMIN_BASE_PATH": "/internal-console/8d98fa5f0df14cabae1ddf37cb6ef4f5",
  "ADMIN_AUTH_MODE": "local",
  "ADMIN_SESSION_TTL_SECONDS": "28800",
  "ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS": "5",
  "ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS": "600"
}
```

字段说明如下。

### `AUTH_COOKIE_NAME`

浏览器端 session cookie 名称。默认值为：

```text
resume_session
```

### `AUTH_SESSION_TTL_SECONDS`

默认 session 生命周期，单位为秒。默认值为 14 天：

```text
1209600
```

### `AUTH_QR_DEFAULT_TTL_SECONDS`

默认短码生命周期，单位为秒。默认值为 15 分钟：

```text
900
```

### `AUTH_QR_RATE_LIMIT_MAX_ATTEMPTS`

`/auth/qr` 在统计窗口内允许的最大失败次数。默认值：

```text
8
```

### `AUTH_QR_RATE_LIMIT_WINDOW_SECONDS`

`/auth/qr` 的失败统计窗口与临时阻断时长，单位为秒。默认值：

```text
600
```

### `AUTH_PUBLIC_PATHS`

公开放行路径与前缀列表。推荐值：

```text
/unlock,/auth/qr,/auth/logout,/_astro/*,/favicon.ico,/favicon.svg
```

约束：

- 精确路径直接写路径
- 前缀路径使用 `/*` 形式
- 不应再使用宽泛的扩展名放行策略

### `ADMIN_BASE_PATH`

后台入口路径。建议使用长随机字符串目录。

示例：

```text
/internal-console/8d98fa5f0df14cabae1ddf37cb6ef4f5
```

该路径用于降低被枚举概率，真正的访问控制由后台认证承担。

### `ADMIN_AUTH_MODE`

后台认证模式。默认推荐：

```text
local
```

可选值：

- `local`
- `access`
- `access_with_local_fallback`

### `ADMIN_PASSWORD_HASH`

本地后台密码的 PBKDF2 hash。启用 `local` 或 `access_with_local_fallback` 时必须配置。

生成方式：

```sh
npm run hash-admin-password
```

建议通过 Cloudflare Pages Secret 配置，不写入仓库。

### `ADMIN_SESSION_TTL_SECONDS`

后台登录 session 生命周期，单位为秒。默认值为 8 小时：

```text
28800
```

### `ADMIN_SESSION_COOKIE_NAME`

后台 session cookie 名称。默认值为：

```text
resume_admin_session
```

该 cookie 独立于简历访问 cookie。

### `ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS`

后台密码登录在统计窗口内允许的最大失败次数。默认值：

```text
5
```

### `ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS`

后台密码登录失败统计窗口与临时阻断时长，单位为秒。默认值：

```text
600
```

### `ADMIN_ACCESS_DOMAIN`

Cloudflare Access 团队域名，例如：

```text
https://example.cloudflareaccess.com
```

### `ADMIN_ACCESS_AUD`

Cloudflare Access 应用的 Audience 值。后台插件使用该值校验访问 JWT。

### `AUTH_COOKIE_DOMAIN`

可选项。仅在明确需要跨子域共享 session cookie 时设置。

## 第四步：配置后台认证

默认推荐使用本地后台密码：

```text
ADMIN_AUTH_MODE=local
```

并配置：

```text
ADMIN_PASSWORD_HASH=<hash-admin-password 输出值>
```

登录成功后会写入独立后台 cookie：

```text
resume_admin_session
```

该 cookie 的路径限定为 `ADMIN_BASE_PATH`。

### 可选：配置 Cloudflare Access

如需使用 Cloudflare Access，创建一个 Self-hosted Application，仅匹配后台路径。

建议的保护范围：

- `<ADMIN_BASE_PATH>`
- `<ADMIN_BASE_PATH>/*`

建议策略：

- 只允许管理员邮箱或指定用户组访问
- 默认拒绝其他身份

Access 负责：

- 后台入口认证
- 管理员身份识别

应用内部仍会继续执行：

- 后台写接口同源校验
- 后台响应头安全收口

如需 Access 配置异常时仍可进入本地密码登录，可设置：

```text
ADMIN_AUTH_MODE=access_with_local_fallback
```

有 Access JWT 但校验失败时不会降级。

## 第五步：检查 `wrangler.jsonc`

项目的关键配置位于：

- `pages_build_output_dir`
- `d1_databases`
- `vars`

要求：

- `pages_build_output_dir` 必须为 `dist`
- `functions/` 目录必须与项目一起部署
- `wrangler.jsonc` 与 Dashboard 配置保持一致

## 第六步：部署 Pages 项目

### 方案 A：Git 集成部署

这是最推荐的方式。

推荐配置：

- Build command: `npm run build`
- Build output directory: `dist`

优点：

- 每次推送自动触发部署
- 易于管理预览环境与生产环境
- `functions/` 与构建脚本会一并参与部署

### 方案 B：Wrangler CLI 部署

如果需要从本地手动部署，可执行：

```sh
npm run build
npx wrangler pages deploy "dist"
```

应在仓库根目录执行，确保：

- `functions/` 能被正确识别
- `wrangler.jsonc` 能被正确读取

## 不推荐的方式

不要使用 Dashboard 拖拽上传作为本项目的正式部署方式。

原因：

- 该方式无法按项目预期处理 `functions/`
- unlock、session 与后台管理链路无法保证生效

## 第七步：部署后验证

建议至少完成以下 smoke test。

### 1. 未登录访问应跳转到 `/unlock`

建议验证：

- `/`
- `/print`
- `/resume/master`
- `/resume/<id>`
- `/resume/<id>/print`
- `/resumes`

### 2. 公开路径应正常放行

建议验证：

- `/unlock`
- `/auth/qr`
- `/auth/logout`
- `/_astro/*`
- `/favicon.ico`
- `/favicon.svg`

### 3. 后台路径应受认证保护

访问：

```text
https://<your-domain><ADMIN_BASE_PATH>
```

预期：

- 默认模式下进入后台密码登录
- 通过后进入后台控制台

### 4. 后台短码管理应可用

建议验证：

- 创建短码
- 复制邀请链接
- 使用链接完成 unlock
- 禁用短码
- 启用短码
- 延长短码
- 增加限次短码的次数额度
- 禁用时吊销关联 session

### 5. `/auth/qr` 限流应生效

连续提交错误短码，确认达到阈值后页面出现限流提示。

## 常见问题

### 后台返回 500，提示缺少 `ADMIN_PASSWORD_HASH`

说明启用了本地后台密码，但未配置密码 hash。执行：

```sh
npm run hash-admin-password
```

将输出值配置到 `ADMIN_PASSWORD_HASH`。

### 后台返回 500，提示缺少 `ADMIN_ACCESS_DOMAIN` 或 `ADMIN_ACCESS_AUD`

说明启用了 `ADMIN_AUTH_MODE=access`，但 Access 变量未配置完整。请补齐：

- `ADMIN_ACCESS_DOMAIN`
- `ADMIN_ACCESS_AUD`

### 后台路径可访问，但未进入控制台

优先检查：

- `ADMIN_BASE_PATH` 是否与 Access 应用路径一致
- Access 策略是否允许管理员身份
- 是否误将后台路径配置到其他 Pages 项目

### `/auth/qr` 频繁出现限流提示

检查：

- `AUTH_QR_RATE_LIMIT_MAX_ATTEMPTS`
- `AUTH_QR_RATE_LIMIT_WINDOW_SECONDS`
- 是否存在错误脚本或异常请求持续提交无效短码
