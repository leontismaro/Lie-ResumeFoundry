# 使用脚本生成二维码与邀请链接

本文说明如何使用项目自带脚本生成二维码与邀请链接，并明确脚本与后台 token 管理控制台的职责边界。

## 使用方式概览

项目提供两种 token 发放方式：

- 后台控制台
  适合人工发放、禁用、启用、延长与追加次数
- `npm run issue-qr`
  适合本地调试、自动化发码、批量生成或无浏览器环境

两者写入同一份 D1 数据，因此：

- 脚本生成的 token 可以在后台控制台中继续管理
- 后台对 token 的禁用、启用、延长或追加次数会立即影响脚本创建的链接

## 脚本职责

发码脚本执行以下工作：

1. 生成高强度随机 token
2. 计算 token 的 SHA-256 哈希
3. 将 token 元数据写入 D1
4. 生成带 `#t=...` 片段的邀请链接
5. 输出二维码 SVG 文件

## 先决条件

- 已执行 `npm install`
- 已完成 `npx wrangler login`
- 已创建并初始化目标 D1 数据库
- `wrangler.jsonc` 中的 `AUTH_DB` 绑定有效

初始化数据库可执行：

```sh
npx wrangler d1 execute "lies-resumefoundry-auth" --remote --file "database/schema.sql"
```

本地环境则使用：

```sh
npx wrangler d1 execute "lies-resumefoundry-auth" --local --file "database/schema.sql"
```

## 脚本入口

命令：

```sh
npm run issue-qr -- [参数]
```

对应文件：

```text
scripts/issue-qr.mjs
```

## 基本用法

### 远程 D1

```sh
npm run issue-qr -- \
  --base-url "https://resume.example.com"
```

默认行为：

- 写入远程 D1
- 模式为 `single_use`
- token 有效期为 15 分钟
- session 策略为 `fixed_ttl`
- session 有效期为 14 天
- 跳转目标为 `/`

### 本地 D1

```sh
npm run issue-qr -- \
  --base-url "http://127.0.0.1:8788" \
  --local
```

## 输出结果

脚本执行成功后，会输出：

- 二维码文件路径
- 邀请链接
- 访问模式
- token 有效期与过期时间
- session 策略与会话时长
- 可选备注

同时会在本地生成二维码文件，例如：

```text
generated-qr/invite-20260420-212530.svg
```

生成的邀请链接格式类似：

```text
https://resume.example.com/unlock?next=%2Fresume%2Fai-platform#t=<token>
```

说明：

- `#t=<token>` 位于 URL fragment 中，不会进入服务端请求 URL
- D1 中保存的是 `token_hash`，不是明文 token
- token 的最终跳转目标以数据库中的 `next_path` 为准

## 参数说明

### `--base-url`

指定邀请链接所面向的站点根地址。

示例：

```sh
--base-url "https://resume.example.com"
```

本地调试可使用：

```sh
--base-url "http://127.0.0.1:8788"
```

### `--next`

指定验证成功后的站内目标路径。

示例：

```sh
--next "/resume/ai-platform"
```

要求：

- 必须是站内路径
- 必须以 `/` 开头

常见值：

- `/`
- `/print`
- `/resume/ai-platform`
- `/resume/ai-platform/print`
- `/resumes`

### `--mode`

指定 token 模式。支持：

- `single_use`
- `reusable_until_expire`
- `limited_uses`

#### `single_use`

首次成功兑换后立即耗尽，适合一次性投递。

#### `reusable_until_expire`

在有效期内可重复兑换，适合同一组织内部多次访问。

#### `limited_uses`

限制总成功兑换次数，适合需要控制扩散范围的场景。

### `--max-uses`

仅在 `limited_uses` 模式下使用。

示例：

```sh
--mode "limited_uses" --max-uses 3
```

含义：

- 最多允许成功兑换 3 次
- 每次成功兑换都会消耗一次使用次数
- 即使后续 session 被退出或吊销，该次兑换仍视为已使用

### `--ttl-minutes`

指定 token 本身的有效期，单位为分钟。

示例：

```sh
--ttl-minutes 30
```

### `--session-policy`

指定通过 token 创建 session 时采用的策略。支持：

- `fixed_ttl`
- `cap_to_invite_expiry`

#### `fixed_ttl`

session 按自身 TTL 独立过期，与 token 剩余寿命无关。

#### `cap_to_invite_expiry`

session 的最终过期时间不会晚于 token 过期时间。

### `--session-ttl-minutes`

指定 session TTL，单位为分钟。

示例：

```sh
--session-ttl-minutes 1440
```

表示 session 可持续 1 天。

### `--note`

记录备注信息，用于后台追踪。

示例：

```sh
--note "投递给某公司 HR"
```

### `--out`

手动指定二维码 SVG 输出路径。

示例：

```sh
--out "generated-qr/ai-platform-demo.svg"
```

### `--local` 与 `--remote`

决定写入本地 D1 还是远程 D1。

- `--local`
  写入本地 D1
- `--remote`
  写入远程 D1

脚本默认写入远程 D1。

### `--database`

指定目标 D1 数据库名称。默认值优先读取环境变量 `D1_DATABASE_NAME`，否则回退为：

```text
lies-resumefoundry-auth
```

## 示例

### 生成 AI 平台版一次性链接

```sh
npm run issue-qr -- \
  --base-url "https://resume.example.com" \
  --next "/resume/ai-platform" \
  --mode "single_use" \
  --ttl-minutes 15 \
  --note "AI 平台岗位投递"
```

### 生成可复用的目录页链接

```sh
npm run issue-qr -- \
  --base-url "https://resume.example.com" \
  --next "/resumes" \
  --mode "reusable_until_expire" \
  --ttl-minutes 1440 \
  --session-policy "cap_to_invite_expiry"
```

### 生成限次打印版链接

```sh
npm run issue-qr -- \
  --base-url "https://resume.example.com" \
  --next "/resume/full-stack/print" \
  --mode "limited_uses" \
  --max-uses 2 \
  --ttl-minutes 120 \
  --session-ttl-minutes 60
```

## 使用建议

- 自动化发码使用脚本
- 日常人工管理使用后台控制台
- 脚本输出的明文 token 不应再写入仓库文档或长期保存在命令历史中

## 备注

脚本的默认时长参数采用“分钟”作为输入单位；运行时环境变量则使用“秒”作为配置单位。两者职责不同，使用时应分别理解。
