# 后台短码管理

本文说明后台控制台的职责边界、访问方式、运行要求与操作规则。

## 功能定位

后台控制台用于管理访问短码的完整生命周期，覆盖以下操作：

- 查看短码列表与状态摘要
- 创建短码
- 禁用短码
- 启用短码
- 延长有效期
- 增加限次短码的可用次数
- 可选吊销由该短码创建的 session

简历正文、样式与页面模板仍以仓库文件为准：

- 简历内容位于 `src/content/resumes/`
- 样式实现位于 `src/components/resume-styles/`
- 后台不提供在线内容编辑

## 访问模型

后台具备两层入口控制：

1. 隐藏路径  
   由 `ADMIN_BASE_PATH` 指定，例如：

   ```text
   /internal-console/8d98fa5f0df14cabae1ddf37cb6ef4f5
   ```

2. Cloudflare Access  
   真正的访问控制边界。即使后台路径被发现，仍需通过 Access 认证。

说明：

- 隐藏路径用于降低被枚举概率
- 真正的访问控制边界由 Cloudflare Access 提供

## 运行时依赖

后台依赖以下组件：

- `functions/_middleware.ts`
- `src/lib/admin/*`
- D1 `invite_tokens`
- D1 `sessions`
- Cloudflare Access

后台写接口额外包含：

- 同源写请求校验
- 基础安全响应头

## 本地调试

### 1. 准备环境变量

复制示例文件：

```sh
cp ".dev.vars.example" ".dev.vars"
```

本地示例默认启用：

```text
ADMIN_BYPASS_ACCESS=true
```

这表示本地 `wrangler pages dev` 环境下不校验真实 Access 身份，而是使用：

```text
ADMIN_BYPASS_USER_EMAIL
```

作为后台显示的管理员身份。

### 2. 初始化本地数据库

```sh
npx wrangler d1 execute "lies-resumefoundry-auth" --local --file "database/schema.sql"
```

### 3. 启动完整本地运行时

```sh
npm run build
npx wrangler pages dev "dist" --port 8788 --ip 127.0.0.1
```

### 4. 访问后台

后台地址格式为：

```text
http://127.0.0.1:8788<ADMIN_BASE_PATH>
```

默认示例值为：

```text
http://127.0.0.1:8788/internal-console/8d98fa5f0df14cabae1ddf37cb6ef4f5
```

## 生产配置

生产环境必须配置：

- `ADMIN_BASE_PATH`
- `ADMIN_ACCESS_DOMAIN`
- `ADMIN_ACCESS_AUD`

并确保：

- Cloudflare Access 保护 `<ADMIN_BASE_PATH>` 与 `<ADMIN_BASE_PATH>/*`
- `ADMIN_BYPASS_ACCESS` 未启用

## 目标路径来源

后台创建短码时的“目标路径”下拉选项不是手写列表，而是构建期自动生成。

来源脚本：

```text
scripts/generate-admin-route-options.mjs
```

生成结果：

```text
src/generated/admin-route-options.ts
```

`npm run dev` 与 `npm run build` 会自动刷新该文件。

生成的路径选项覆盖：

- 主简历主页 `/`
- 主简历打印页 `/print`
- 各简历网页版 `/resume/<id>`
- 各简历打印版 `/resume/<id>/print`
- 简历目录页 `/resumes`

## 短码模式

后台支持三种短码模式。

### 一次性

- 模式值：`single_use`
- 成功兑换一次后即视为耗尽
- 已使用的一次性短码不提供重新启用或追加次数

### 有效期内可重复使用

- 模式值：`reusable_until_expire`
- 在未禁用且未过期前，可重复兑换

### 限制使用次数

- 模式值：`limited_uses`
- 可配置 `max_uses`
- 次数耗尽后，可通过后台追加次数

## Session 策略

### 固定会话时长

- 策略值：`fixed_ttl`
- session 仅按自身 TTL 过期

### 会话时长不超过邀请码剩余有效期

- 策略值：`cap_to_invite_expiry`
- session 最晚不会晚于短码过期

## 状态与操作规则

后台会根据短码状态显示可执行操作。

### 禁用

禁用短码后：

- 该短码不再允许兑换新的 session
- 已存在的 session 默认不受影响
- 可选同时吊销该短码已签发的 session

### 启用

启用只负责取消“禁用”状态，不承担恢复全部状态的职责。

适用规则：

- 已禁用且仍满足使用条件时，可启用
- 已过期短码不能仅靠启用恢复
- 已耗尽的限次短码不能仅靠启用恢复
- 已使用的一次性短码不提供启用

### 延长有效期

适用场景：

- 需要延长未过期短码的寿命
- 已过期但仍可恢复的短码

不适用场景：

- 已使用的一次性短码

### 增加次数

仅适用于 `limited_uses`。

用途：

- 为次数已耗尽或即将耗尽的短码增加 `max_uses`

## 后台与脚本的协同方式

推荐分工如下：

- 脚本负责自动化发码
- 后台负责日常运营动作

共享规则：

- 两者写入同一份 D1 数据
- 两者遵循相同的短码模型
- 后台操作会立即影响脚本创建的短码

## 常见问题

### 打开后台提示缺少 `ADMIN_ACCESS_DOMAIN` 或 `ADMIN_ACCESS_AUD`

说明生产配置不完整。请检查：

- `ADMIN_ACCESS_DOMAIN`
- `ADMIN_ACCESS_AUD`

### 本地后台可以打开，线上被拒绝

优先检查：

- Access 应用是否覆盖了正确路径
- `ADMIN_BASE_PATH` 是否与部署环境一致
- 管理员账号是否在 Access 允许列表内

### 后台里看不到新简历路径

说明后台目标路径清单尚未刷新。执行以下任一命令即可：

```sh
npm run dev
```

或：

```sh
npm run build
```
