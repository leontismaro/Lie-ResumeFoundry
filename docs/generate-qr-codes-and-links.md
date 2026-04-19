# 使用脚本生成二维码与邀请链接

本文说明如何使用项目自带脚本生成二维码与邀请链接，用于访问受保护的简历站点。

项目当前的鉴权模型基于：

- Cloudflare Pages Functions
- D1 中的 `invite_tokens` 表
- D1 中的 `sessions` 表
- 浏览器端的会话 Cookie

发码脚本的职责是：

1. 生成一个高强度随机 token
2. 计算 token 的 SHA-256 哈希
3. 将哈希后的 token 记录写入 D1 的 `invite_tokens`
4. 生成带 `#t=...` 片段的邀请链接
5. 将链接写入二维码 SVG 文件

## 先决条件

在使用脚本前，请先确认：

- 已执行 `npm install`
- 已完成 `npx wrangler login`
- 已创建并初始化 D1 数据库
- `wrangler.jsonc` 中的 `d1_databases` 配置有效

如需初始化数据库，可执行：

```sh
npx wrangler d1 execute "lies-resumefoundry-auth" --remote --file "database/schema.sql"
```

本地开发环境则使用：

```sh
npx wrangler d1 execute "lies-resumefoundry-auth" --local --file "database/schema.sql"
```

## 脚本入口

项目提供的命令为：

```sh
npm run issue-qr -- [参数]
```

对应脚本文件：

```text
scripts/issue-qr.mjs
```

## 最简单的用法

```sh
npm run issue-qr -- \
  --base-url "https://resume.example.com"
```

默认行为：

- 写入远程 D1
- 访问模式为 `single_use`
- 邀请码默认有效期为 15 分钟
- Session 策略为 `fixed_ttl`
- 默认跳转目标为 `/`
- 输出文件位于 `generated-qr/invite-<timestamp>.svg`

## 输出内容

脚本执行成功后，会输出：

- 二维码文件路径
- 邀请链接
- 访问模式
- 过期时间
- Session 策略与有效期
- 可选备注

同时会在本地生成二维码文件，例如：

```text
generated-qr/invite-20260420-212530.svg
```

生成的邀请链接格式类似：

```text
https://resume.example.com/unlock?next=%2Fresume%2Fai-platform#t=<token>
```

注意事项：

- token 放在 URL fragment 中，即 `#t=...`
- fragment 不会进入服务端请求 URL
- 这样可以降低 token 被日志、历史记录或 Referer 暴露的概率

## 常用参数说明

### `--base-url`

指定邀请链接的站点根地址。

示例：

```sh
--base-url "https://resume.example.com"
```

用途：

- 决定二维码最终指向哪个站点
- 不影响 D1 的写入位置

如果本地调试，可以传：

```sh
--base-url "http://127.0.0.1:8788"
```

### `--next`

指定验证成功后跳转到哪个站内路径。

示例：

```sh
--next "/resume/ai-platform"
```

规则：

- 必须是站内路径
- 必须以 `/` 开头
- 不能省略前导斜杠

正确示例：

```sh
--next "/"
--next "/print"
--next "/resume/full-stack"
```

错误示例：

```sh
--next "resume/full-stack"
```

### `--mode`

指定邀请码的使用模式。

当前支持三种模式：

- `single_use`
- `reusable_until_expire`
- `limited_uses`

### `--max-uses`

仅在 `limited_uses` 模式下使用。

示例：

```sh
--mode "limited_uses" --max-uses 3
```

含义：

- 该邀请码最多成功兑换 3 次
- 每次成功兑换都会消耗一次使用次数
- 即使后续对应 session 被退出或失效，这次兑换仍然视为已经使用

### `--ttl-minutes`

邀请码本身的有效期，单位为分钟。

示例：

```sh
--ttl-minutes 30
```

### `--session-policy`

指定通过邀请码登录后，创建 session 时采用的策略。

当前支持：

- `fixed_ttl`
- `cap_to_invite_expiry`

#### `fixed_ttl`

含义：

- 只按照 session TTL 计算浏览器会话有效期
- 与邀请码剩余寿命无关

#### `cap_to_invite_expiry`

含义：

- session 的最终过期时间不会晚于邀请码本身的过期时间
- 适合希望“邀请码过期后连已登录会话也尽快结束”的场景

示例：

- 邀请码 15 分钟后过期
- session TTL 配为 7 天
- 使用 `cap_to_invite_expiry`

则实际 session 有效期最多只有邀请码剩余寿命。

### `--session-ttl-minutes`

指定 session 有效期，单位为分钟。

示例：

```sh
--session-ttl-minutes 1440
```

表示 session 可持续 1 天。

### `--note`

用于记录邀请码用途备注。

示例：

```sh
--note "投递给某公司 HR"
```

该备注会写入 D1 的 `invite_tokens.note` 字段，便于后续追踪。

### `--out`

手动指定二维码 SVG 输出路径。

示例：

```sh
--out "generated-qr/ai-platform-demo.svg"
```

### `--local` 与 `--remote`

用于决定写入本地 D1 还是远程 D1。

- `--remote`
  写入 Cloudflare 远程 D1
- `--local`
  写入本地 Wrangler 管理的 D1

默认行为是 `--remote`。

## 常见使用场景

### 生成一个面向主简历的单次邀请码

```sh
npm run issue-qr -- \
  --base-url "https://resume.example.com" \
  --mode "single_use" \
  --ttl-minutes 15 \
  --next "/"
```

### 生成一个面向 AI 平台版的可重复邀请码

```sh
npm run issue-qr -- \
  --base-url "https://resume.example.com" \
  --mode "reusable_until_expire" \
  --ttl-minutes 30 \
  --next "/resume/ai-platform"
```

### 生成一个最多使用两次的全栈版邀请码

```sh
npm run issue-qr -- \
  --base-url "https://resume.example.com" \
  --mode "limited_uses" \
  --max-uses 2 \
  --ttl-minutes 60 \
  --next "/resume/full-stack" \
  --note "二面复用"
```

### 生成一个本地调试用邀请码

```sh
npm run issue-qr -- \
  --base-url "http://127.0.0.1:8788" \
  --local \
  --mode "reusable_until_expire" \
  --ttl-minutes 30 \
  --next "/resume/master"
```

## 发码前推荐的本地验证流程

如果需要在本地完整验证二维码链路，推荐按以下顺序操作：

1. 初始化本地数据库

```sh
npx wrangler d1 execute "lies-resumefoundry-auth" --local --file "database/schema.sql"
```

2. 构建站点

```sh
npm run build
```

3. 启动本地 Pages 运行时

```sh
npx wrangler pages dev "dist" --port 8788 --ip 127.0.0.1
```

4. 生成本地邀请码

```sh
npm run issue-qr -- \
  --base-url "http://127.0.0.1:8788" \
  --local \
  --mode "single_use" \
  --ttl-minutes 10 \
  --next "/"
```

5. 打开脚本输出的邀请链接或二维码

## D1 中记录了什么

脚本并不会直接向站点发送登录请求，而是直接通过 `wrangler d1 execute` 写入数据库。

写入 `invite_tokens` 的主要字段包括：

- `id`
- `token_hash`
- `mode`
- `max_uses`
- `used_count`
- `expires_at`
- `note`
- `session_policy`
- `session_ttl_seconds`

注意：

- 数据库中保存的是 `token_hash`
- 不保存明文 token
- 明文 token 只存在于脚本输出的链接与二维码中

## 如何查看已生成的邀请码

可以直接查询 D1。

### 查询本地 D1

```sh
npx wrangler d1 execute "lies-resumefoundry-auth" --local --command \
"select id, mode, used_count, expires_at, note from invite_tokens order by created_at desc limit 10;"
```

### 查询远程 D1

```sh
npx wrangler d1 execute "lies-resumefoundry-auth" --remote --command \
"select id, mode, used_count, expires_at, note from invite_tokens order by created_at desc limit 10;"
```

## 如何查看 session

登录成功后，站点会在 `sessions` 表中创建一条记录。可以用以下方式检查：

```sh
npx wrangler d1 execute "lies-resumefoundry-auth" --remote --command \
"select id, invite_id, expires_at, revoked_at, created_at from sessions order by created_at desc limit 10;"
```

## 常见问题

### 报错 “`--next` 必须是站内路径”

说明传入的路径没有以 `/` 开头。

错误：

```sh
--next "resume/full-stack"
```

正确：

```sh
--next "/resume/full-stack"
```

### `limited_uses` 模式报错

如果使用：

```sh
--mode "limited_uses"
```

则必须同时传：

```sh
--max-uses <正整数>
```

### 执行时提示 `wrangler d1 execute` 失败

优先检查：

1. 是否已经执行 `npx wrangler login`
2. `wrangler.jsonc` 中的数据库绑定是否正确
3. 远程数据库是否已经创建
4. 本地是否先初始化了 schema

### 已生成二维码，但扫码后提示 token 无效

优先检查：

1. 邀请码是否已过期
2. `single_use` 或 `limited_uses` 是否已经被用尽
3. 当前访问的站点域名是否与 `--base-url` 对应
4. 部署环境是否连接到了正确的 D1 数据库

## 建议的使用策略

对于真实简历投递场景，推荐：

- 默认使用 `single_use`
- 或者使用 `limited_uses` 并配合较短 TTL
- 对重要定向投递，明确指定 `--next`
- 对公开测试或多轮面试复用场景，再考虑 `reusable_until_expire`

如果希望 session 生命周期不要显著长于邀请码生命周期，建议使用：

```sh
--session-policy "cap_to_invite_expiry"
```

## 相关文档

- [部署到 Cloudflare](./deploy-to-cloudflare.md)
- [创建与编辑简历](./create-and-edit-a-resume.md)
