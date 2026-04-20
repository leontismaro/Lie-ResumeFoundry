# 创建与编辑简历

本文说明如何在本项目中创建一份新的简历、如何编辑现有简历，以及内容目录中的各类 Markdown 文件分别承担什么职责。本文面向仓库使用者，默认读者已经完成基础环境安装，并能够在本地运行 Node.js 与 `npm`。

## 适用范围

本文覆盖以下场景：

- 创建一份全新的简历版本
- 基于现有简历复制出一个定制版本
- 修改简历的标题、摘要、展示顺序与样式
- 新增、隐藏、重排某个内容区块
- 本地预览改动结果

本文不覆盖样式实现本身。若需要创建新样式，请参阅 [创建新的样式](./create-a-new-style.md)。

## 先决条件

- Node.js `>= 22.12.0`
- 已执行 `npm install`

建议在开始编辑前先熟悉项目的内容目录结构：

```text
src/content/resumes/
├── master/
│   ├── _meta.md
│   ├── 00-profile.md
│   ├── 01-experience.md
│   ├── 02-projects.md
│   ├── 03-skills.md
│   └── 04-education.md
├── ai-platform/
└── full-stack/
```

其中，每个子目录代表一份独立简历，目录名即 `resumeId`。

## 内容模型概览

一份简历由三类 Markdown 文件组成：

1. `_meta.md`
   这份简历的元数据。用于定义列表名称、默认样式、是否展示在 `/resumes`、是否为主简历等站点级配置。
2. `00-profile.md`
   简历头部信息，也称 hero/profile。包含姓名、副标题、摘要、联系方式和头部说明文案。
3. `01-*.md`、`02-*.md` 等 section 文件
   简历正文区块，例如工作经历、项目经历、技能栈、教育与资质。

### `_meta.md` 示例

```md
---
kind: meta
label: 'AI 平台版'
kicker: 'AI / Backend / Infra'
summary: '偏 AI 平台、后端架构与工程基础设施，适合平台工程和高级后端岗位。'
listed: true
isDefault: false
isMaster: false
styleId: glass
hiddenSectionSlugs:
  - education
order: 1
---
```

字段说明：

- `kind`
  固定为 `meta`，用于内容集合识别。
- `label`
  简历名称，用于 `/resumes` 页面和其他简历目录场景。
- `kicker`
  简历的短分类文案，常用于头部小标题。
- `summary`
  简历摘要，用于列表卡片与目录展示。
- `listed`
  是否出现在 `/resumes` 页面。
- `isDefault`
  是否为默认简历。项目中必须且只能有一个。
- `isMaster`
  是否为主简历。项目中必须且只能有一个。主简历同时映射到 `/` 与 `/print`。
- `styleId`
  这份简历使用的样式标识，例如 `glass` 或 `editorial`。
- `hiddenSectionSlugs`
  需要整体隐藏的区块 slug 列表。即使区块文件存在，也不会渲染。
- `order`
  简历在目录中的排序值，越小越靠前。

### `00-profile.md` 示例

```md
---
title: '张三'
subtitle: '高级软件工程师 / AI Platform & Full-Stack'
summary: '拥有平台工程、AI 应用落地、后端架构与全栈交付经验。'
sectionSlug: profile
contacts:
  - label: 邮箱
    value: zhangsan@example.com
    href: mailto:zhangsan@example.com
  - label: GitHub
    value: github.com/zhangsan
    href: https://github.com/zhangsan
kind: hero
layout: full
order: 0
---

这里写这份简历版本的头部说明，例如定位、年限、优势领域与目标岗位。
```

字段说明：

- `kind`
  固定为 `hero`。
- `title`
  姓名或主标题。
- `subtitle`
  副标题，一般为职位方向。
- `summary`
  头部摘要。
- `contacts`
  联系方式数组。
- `sectionSlug`
  固定为 `profile`。
- `layout`
  对 hero 来说通常保持 `full`。
- `order`
  头部排序，通常为 `0`。

### section 文件示例

```md
---
title: '工作经历'
summary: '覆盖 AI 平台、复杂后端系统与全栈交付的核心经历。'
sectionSlug: experience
kind: section
layout: full
order: 1
---

### 某公司 / 某团队

**高级工程师** | 2022.01 - 至今

- 负责某平台的设计与交付。
- 解决复杂性能瓶颈并产出量化结果。
```

字段说明：

- `kind`
  固定为 `section`。
- `title`
  区块标题。
- `summary`
  区块摘要。
- `sectionSlug`
  区块唯一标识。会影响锚点链接、导航和部分样式分支。
- `layout`
  布局提示。目前 `glass` 样式会根据它区分主栏与侧栏；`editorial` 样式通常按单栏顺序渲染。
- `order`
  区块顺序，越小越靠前。

可选字段：

- `hidden: true`
  单独隐藏该区块。即使文件仍然存在，也不会渲染。

## 方法一：使用脚本快速创建一份简历

项目提供了 `create-resume` 脚本，用于生成新简历目录和基础 Markdown 文件。

### 创建空白骨架

```sh
npm run create-resume -- --id "staff-backend"
```

执行后会生成：

```text
src/content/resumes/staff-backend/
├── _meta.md
├── 00-profile.md
├── 01-experience.md
├── 02-projects.md
├── 03-skills.md
└── 04-education.md
```

### 常用参数

```sh
npm run create-resume -- \
  --id "staff-backend" \
  --label "Staff 后端版" \
  --kicker "Backend / Platform" \
  --summary "突出平台架构、服务治理与后端工程能力。" \
  --style "editorial" \
  --order 3 \
  --listed true
```

参数说明：

- `--id`
  必填。新简历目录名，要求为 `kebab-case`。
- `--label`
  简历名称。
- `--kicker`
  简历短分类文案。
- `--summary`
  简历摘要。
- `--style`
  目标样式，默认 `glass`。
- `--order`
  简历排序值。不传时自动追加到列表末尾。
- `--listed`
  是否显示在 `/resumes`。
- `--default`
  是否设为默认简历。
- `--master`
  是否设为主简历。

### 基于现有简历复制

如果希望快速从既有简历派生一个新版本，可以使用 `--source`：

```sh
npm run create-resume -- \
  --id "ml-platform" \
  --label "ML 平台版" \
  --source "ai-platform"
```

该模式会复制源简历的所有 Markdown 内容文件，但不会复制源简历的 `_meta.md`。新目录会生成新的 `_meta.md`，因此：

- 正文内容会沿用源简历
- 新简历的 `label`、`kicker`、`summary`、`styleId`、`order` 等元数据会使用本次命令提供的值

使用 `--source` 后，通常仍需手动检查以下内容：

- `00-profile.md` 中的头部摘要是否仍然适合新版本
- `01-experience.md` 和 `02-projects.md` 中是否保留了不再相关的经历
- `03-skills.md` 中的技能分组是否仍然匹配目标岗位

## 方法二：手动创建一份简历

如果不希望使用脚本，也可以直接在 `src/content/resumes/` 下新建目录。

步骤如下：

1. 新建目录，例如 `src/content/resumes/site-reliability/`
2. 创建 `_meta.md`
3. 创建 `00-profile.md`
4. 按需创建 section 文件，例如：
   - `01-experience.md`
   - `02-projects.md`
   - `03-skills.md`
   - `04-education.md`

只要目录中至少包含：

- 一个 `kind: meta` 的 `_meta.md`
- 一个 `kind: hero` 的 `00-profile.md`

并且字段满足内容 schema 要求，项目就可以正确识别这份简历。

## 编辑现有简历

### 修改简历的标题、列表文案和默认样式

编辑 `_meta.md`：

- 修改 `label` 更新简历名称
- 修改 `kicker` 更新目录页短标签
- 修改 `summary` 更新目录页摘要
- 修改 `styleId` 切换样式
- 修改 `listed` 决定是否显示在 `/resumes`

### 修改首页对应的主简历

编辑各简历目录的 `_meta.md`，确保：

- 目标简历设置 `isMaster: true`
- 原主简历设置 `isMaster: false`

项目要求 `isMaster` 必须且只能有一个，否则构建时会报错。

### 修改默认简历

同理，`isDefault` 也必须且只能有一个。

### 修改头部信息与联系方式

编辑 `00-profile.md`：

- `title` 控制姓名或主标题
- `subtitle` 控制副标题
- `summary` 控制头部摘要
- `contacts` 控制联系方式网格
- Markdown 正文部分控制头部补充说明

### 修改正文区块顺序

编辑各个 section 文件中的 `order`。

例如：

- `01-experience.md` 通常设为 `1`
- `02-projects.md` 通常设为 `2`
- `03-skills.md` 通常设为 `3`

如果新增 `05-open-source.md`，可设置：

```md
---
title: '开源贡献'
sectionSlug: open-source
kind: section
layout: full
order: 5
---
```

### 新增区块

新增一个 Markdown 文件即可，例如：

```text
src/content/resumes/ai-platform/05-open-source.md
```

示例内容：

```md
---
title: '开源贡献'
summary: '展示公开代码、社区协作与技术沉淀。'
sectionSlug: open-source
kind: section
layout: full
order: 5
---

### 项目名称

- 描述贡献内容
- 描述影响范围与结果
```

### 隐藏区块

有两种方式。

方式一，在对应 section 文件中直接隐藏：

```md
---
kind: section
hidden: true
---
```

方式二，在 `_meta.md` 中统一隐藏：

```md
---
kind: meta
hiddenSectionSlugs:
  - education
  - skills
---
```

推荐规则：

- 临时隐藏单个区块，使用 `hidden: true`
- 针对某份简历整体裁剪某些区块，使用 `_meta.md` 的 `hiddenSectionSlugs`

## 关于 `layout` 的正确理解

`layout` 是区块的展示提示，而不是内容类型本身。

项目支持：

- `full`
- `compact`

它的含义是：

- `full`
  该区块更适合占据主内容区域，例如工作经历、项目经历。
- `compact`
  该区块更适合作为辅助信息，例如技能栈、教育与资质。

注意事项：

- `layout` 并不直接决定“必须出现在左栏还是右栏”
- 最终如何排版，由具体样式组件决定
- `glass` 样式会利用 `layout` 做主栏 / 侧栏区分
- `editorial` 样式通常按内容顺序单栏渲染

## 本地预览

### 仅预览前端页面

```sh
npm run dev
```

说明：

- 该命令会在启动前自动执行 `scripts/generate-admin-route-options.mjs`
- 后台创建 token 时使用的目标路径下拉列表会同步刷新
- 当你新增简历、调整 `isMaster`、修改简历名称或排序后，重新执行一次 `npm run dev` 或 `npm run build`，即可让后台下拉项与内容目录保持一致

访问：

- `http://127.0.0.1:4321/`
- `http://127.0.0.1:4321/resumes`
- `http://127.0.0.1:4321/resume/<resume-id>`

### 同时验证鉴权链路

如果需要连同 Pages Functions 与 D1 一起验证，应使用：

```sh
npm run build
npx wrangler pages dev "dist" --port 8788 --ip 127.0.0.1
```

这会以更接近 Cloudflare Pages 的方式运行项目。

## 提交前检查清单

建议在提交前至少完成以下检查：

1. 执行 `npm run build`
2. 打开目标简历的 Web 页面与打印页面
3. 检查目录页 `/resumes` 中的名称、摘要和排序
4. 检查区块锚点是否正确
5. 检查隐藏区块是否确实未渲染
6. 检查 `isMaster` 与 `isDefault` 是否仍然各自只有一个

## 常见问题

### 构建时报错 “resume 元数据配置错误”

通常是以下原因之一：

- 多个简历同时设置了 `isMaster: true`
- 多个简历同时设置了 `isDefault: true`
- 某份简历缺少 `_meta.md`
- `_meta.md` 的 frontmatter 字段不符合 schema

### 新增的区块没有显示

优先检查：

- frontmatter 中是否设置了 `kind: section`
- `hidden` 是否误设为 `true`
- `sectionSlug` 是否在 `_meta.md` 的 `hiddenSectionSlugs` 中
- `order` 是否合理

### 区块显示顺序不符合预期

显示顺序由 `order` 决定，而不是文件名本身。文件名建议保留数字前缀，但真正排序以 frontmatter 为准。
