# Lie's ResumeFoundry

![Project Cover](./docs/images/cover.png)
![Project Cover 02](./docs/images/cover02.png)

一个基于 Astro 与 Cloudflare Pages 构建的私有化简历站点模板，面向“多版本简历管理 + 多样式渲染 + 受控访问发布”的使用场景。

项目关注的不只是静态页面生成，而是一套可长期维护、可按岗位拆分、可控制访问入口的简历发布方案：

- 使用 Markdown 驱动简历内容
- 在同一仓库中维护多份简历版本
- 为不同简历版本指定不同渲染样式
- 通过二维码与邀请链接控制访问入口
- 使用 Pages Functions、D1 与后台认证形成完整的发布与管理链路

## 项目提供的功能

### 1. 多简历版本

一套仓库可以同时维护多份简历，例如：

- 全量主简历
- AI 平台版
- 全栈产品版
- 其他定向版本

每份简历位于独立目录：

```text
src/content/resumes/<resume-id>/
```

并通过 `_meta.md`、`00-profile.md` 与 section 文件共同驱动渲染。

### 2. 多样式渲染

项目内置两套样式：

- `glass`
  蓝色玻璃风，强调卡片感、双栏布局与视觉层次
- `editorial`
  社论排版风，强调单栏阅读、留白与内容节奏

每份简历可在 `_meta.md` 中声明 `styleId`，从而独立选择样式，而无需复制正文内容。

### 3. Web / Print 双输出

每份简历默认同时拥有：

- 网页版：`/resume/<id>`
- 打印版：`/resume/<id>/print`

主简历同时映射到：

- `/`
- `/print`

因此，项目可同时满足在线浏览与 PDF 导出需求。

### 4. 内容驱动维护

简历数量、名称、排序、是否展示、默认样式、主简历归属等核心元数据均来自内容目录，而不是额外的硬编码表。

这意味着：

- 新增简历时主要工作集中在内容目录
- 简历维护更接近内容编辑，而不是模板复制
- 内容与展示层保持稳定分离

### 5. 受控访问与后台管理

项目提供两条相互配合的访问控制能力：

- 使用脚本或后台控制台创建 token
- 通过 `/unlock`、`/auth/qr` 与服务端 session 控制受保护页面访问

支持的 token 模式包括：

- `single_use`
- `reusable_until_expire`
- `limited_uses`

支持的 session 策略包括：

- `fixed_ttl`
- `cap_to_invite_expiry`

项目同时提供后台 token 管理控制台。默认由后台密码保护，也可接入 Cloudflare Access，用于：

- 创建 token
- 禁用 token
- 启用 token
- 延长有效期
- 增加限次 token 的可用次数
- 按 token 吊销已签发的 session

简历正文仍通过 Markdown 文件维护，后台不承担在线内容编辑职责。

### 6. Cloudflare 部署链路

项目已接入：

- Cloudflare Pages
- Pages Functions
- D1
- 后台密码认证

用于实现：

- 页面访问拦截
- 邀请 token 校验
- 服务端 session 创建与吊销
- 后台路径认证与管理员身份识别

## 项目优势

### 内容与展示解耦

简历内容与样式实现分离：

- 内容层负责信息组织
- 样式层负责呈现方式

这使得同一份内容可以复用到不同样式，也使新增样式时无需复制既有正文。


### 安全边界清晰

项目的访问与后台边界明确：

- 公开路径由显式白名单控制
- 受保护页面统一经由 session 校验
- `/auth/qr` 具备失败尝试限流
- 后台写接口执行同源校验
- 后台入口使用独立后台 cookie

## 适用场景

本项目适合以下用途：

- 维护一份长期可演进的个人简历站
- 面向不同岗位维护多套简历版本
- 通过二维码或专属链接控制访问范围
- 将简历站部署到 Cloudflare Pages

## 快速开始

### 环境要求

- Node.js `>= 22.12.0`
- `npm`
- Cloudflare 账号
- 已安装并可使用 Wrangler

### 1. 安装依赖

```sh
npm install
```

### 2. 准备本地环境变量

```sh
cp ".dev.vars.example" ".dev.vars"
```

`.dev.vars.example` 中包含本地运行后台控制台所需的默认示例配置。默认示例启用了：

```text
ADMIN_AUTH_MODE=local
```

本地示例密码为：

```text
local-admin-pass
```

生产环境必须替换 `ADMIN_PASSWORD_HASH`。

### 3. 仅预览前端页面

```sh
npm run dev
```

默认访问：

- `http://127.0.0.1:4321/`
- `http://127.0.0.1:4321/resumes`

此模式适合：

- 编辑简历内容
- 调整样式
- 检查页面布局

此模式不验证：

- Pages Functions
- D1
- token 登录链路
- 后台控制台

### 4. 初始化本地 D1

如需完整验证鉴权与后台链路，先初始化本地数据库：

```sh
npx wrangler d1 execute "lies-resumefoundry-auth" --local --file "database/schema.sql"
```

### 5. 使用 Pages 本地运行时启动

```sh
npm run build
npx wrangler pages dev "dist" --port 8788 --ip 127.0.0.1
```

此模式更接近真实部署环境，适合验证：

- 中间件拦截
- `/auth/qr`
- `/auth/logout`
- session cookie
- D1 访问
- 后台控制台

### 6. 打开本地后台

后台入口由 `ADMIN_BASE_PATH` 指定。默认示例值为：

```text
/internal-console/8d98fa5f0df14cabae1ddf37cb6ef4f5
```

本地访问地址为：

```text
http://127.0.0.1:8788/internal-console/8d98fa5f0df14cabae1ddf37cb6ef4f5
```

### 7. 生成本地测试邀请码

项目支持两种方式：

#### 方式 A：通过后台控制台生成

适合人工发放与日常管理。

#### 方式 B：通过脚本生成

```sh
npm run issue-qr -- \
  --base-url "http://127.0.0.1:8788" \
  --local \
  --mode "single_use" \
  --ttl-minutes 10 \
  --next "/"
```

脚本会：

- 向本地 D1 写入 invite token
- 在 `generated-qr/` 下生成二维码 SVG
- 输出可直接访问的邀请链接

## 文档

- [创建与编辑简历](./docs/create-and-edit-a-resume.md)
- [创建新的样式](./docs/create-a-new-style.md)
- [使用脚本生成二维码与邀请链接](./docs/generate-qr-codes-and-links.md)
- [后台 Token 管理](./docs/admin-token-management.md)
- [部署到 Cloudflare](./docs/deploy-to-cloudflare.md)

## 项目结构概览

```text
.
├── docs/                         # 文档
├── database/                     # D1 schema 与数据库脚本
├── functions/                    # Cloudflare Pages Functions
├── public/                       # 静态资源
├── scripts/                      # 创建简历、生成二维码等脚本
├── src/
│   ├── components/               # 通用组件与样式组件
│   ├── content/resumes/          # 简历内容目录
│   ├── generated/                # 构建期生成文件
│   ├── lib/                      # 内容装配、后台与鉴权逻辑
│   ├── pages/                    # 页面路由
│   └── styles/                   # 通用样式与主题样式
├── package.json
└── wrangler.jsonc
```

### 关键目录说明

- `src/content/resumes/`
  所有简历内容的单一事实来源
- `src/components/resume-styles/`
  各个样式的 Web / Print 渲染实现
- `src/lib/admin/`
  后台控制台与 token 管理逻辑
- `src/lib/auth/`
  token、session、路径校验与限流逻辑
- `functions/`
  Pages Functions 入口
