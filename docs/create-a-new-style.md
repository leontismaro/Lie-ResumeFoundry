# 创建新的样式

本文说明如何为本项目新增一套简历样式。样式的职责是决定简历如何渲染与排版，而不是定义简历内容本身。内容由 `src/content/resumes/<resumeId>/` 下的 Markdown 文件驱动，样式则由独立的 Astro 组件与 CSS 文件负责实现。

## 设计原则

在本项目中，内容与样式是两层独立模型：

- `resumeId`
  决定使用哪份简历内容
- `styleId`
  决定使用哪套 Web / Print 渲染方式

这意味着：

- 同一套样式可以被多份简历复用
- 同一份简历可以通过修改 `_meta.md` 中的 `styleId` 切换样式
- 样式组件负责布局与视觉实现，内容层不负责决定最终排版

如果只是想让某份简历切换到已有样式，不需要新增样式，只需编辑该简历的 `_meta.md`：

```md
---
kind: meta
styleId: editorial
---
```

## 当前样式系统结构

相关文件如下：

```text
src/
├── components/
│   ├── ResumeStyleRenderer.astro
│   └── resume-styles/
│       ├── glass/
│       │   ├── GlassResumeWebPage.astro
│       │   └── GlassResumePrintPage.astro
│       └── editorial/
│           ├── EditorialResumeWebPage.astro
│           ├── EditorialResumePrintPage.astro
│           └── EditorialSkillsSection.astro
├── lib/
│   └── resume-style-catalog.ts
└── styles/
    └── resume-themes/
        ├── glass-web.css
        ├── glass-print.css
        ├── editorial-web.css
        └── editorial-print.css
```

职责划分：

- `src/lib/resume-style-catalog.ts`
  注册可用的样式 ID 与样式说明
- `src/components/ResumeStyleRenderer.astro`
  根据 `styleId + variant` 选择具体渲染组件
- `src/components/resume-styles/<style-id>/`
  样式自己的页面组件与可选辅助组件
- `src/styles/resume-themes/`
  样式自己的 Web / Print CSS

## 新增样式的标准流程

以下示例以新增 `minimal` 样式为例。

### 第一步：确定新的 `styleId`

样式 ID 建议使用短横线或小写英文单词，保持语义明确，例如：

- `minimal`
- `mono`
- `executive`

后文以 `minimal` 为例。

### 第二步：在样式目录表中注册

编辑 `src/lib/resume-style-catalog.ts`。

需要完成两件事：

1. 将新样式加入 `resumeStyleIds`
2. 将新样式加入 `resumeStyleCatalog`

示例：

```ts
export const resumeStyleIds = ['glass', 'editorial', 'minimal'] as const;

export const resumeStyleCatalog = [
  {
    id: 'glass',
    label: '蓝色玻璃风',
    summary: '沿用当前的高亮玻璃卡片与双栏浏览体验。',
  },
  {
    id: 'editorial',
    label: '社论排版风',
    summary: '单栏阅读、信息分区和杂志式排版表达。',
  },
  {
    id: 'minimal',
    label: '极简信息风',
    summary: '更克制的排版、较弱装饰和紧凑信息密度。',
  },
] as const;
```

为什么必须先修改这里：

- `src/content.config.ts` 中 `styleId` 的内容 schema 依赖 `resumeStyleIds`
- `_meta.md` 中使用的 `styleId` 必须通过 schema 校验

### 第三步：创建样式组件目录

新增目录：

```text
src/components/resume-styles/minimal/
```

至少需要创建两个文件：

- `MinimalResumeWebPage.astro`
- `MinimalResumePrintPage.astro`

推荐目录结构：

```text
src/components/resume-styles/minimal/
├── MinimalResumeWebPage.astro
└── MinimalResumePrintPage.astro
```

如果新样式需要专门处理某个区块，也可以新增辅助组件，例如：

- `MinimalSkillsSection.astro`
- `MinimalTimeline.astro`

### 第四步：创建样式 CSS 文件

新增：

- `src/styles/resume-themes/minimal-web.css`
- `src/styles/resume-themes/minimal-print.css`

建议保持 Web 与 Print 分离，而不是复用一份过于复杂的 CSS。这样更容易单独优化打印分页、字体尺寸和 A4 版式。

### 第五步：在 `ResumeStyleRenderer` 中接入新样式

编辑 `src/components/ResumeStyleRenderer.astro`。

需要完成：

1. 导入两个新组件
2. 在 `componentMap` 中注册 `minimal`

示例：

```astro
---
import MinimalResumeWebPage from './resume-styles/minimal/MinimalResumeWebPage.astro';
import MinimalResumePrintPage from './resume-styles/minimal/MinimalResumePrintPage.astro';

const componentMap = {
  glass: {
    print: GlassResumePrintPage,
    web: GlassResumeWebPage,
  },
  editorial: {
    print: EditorialResumePrintPage,
    web: EditorialResumeWebPage,
  },
  minimal: {
    print: MinimalResumePrintPage,
    web: MinimalResumeWebPage,
  },
} as const;
---
```

这是当前项目的既有实现方式。也就是说，新增样式不是“只写 CSS 即可”，而是需要同时完成渲染注册。

### 第六步：为某份简历指定新样式

编辑对应简历目录下的 `_meta.md`：

```md
---
kind: meta
styleId: minimal
---
```

完成后，这份简历就会使用 `minimal` 作为默认渲染样式。

## 推荐实现方式

新增样式时，最稳妥的做法是“复制现有样式的最小骨架，再删减重构”，而不是从零开始拼装所有结构。

### 推荐起点一：从 `glass` 开始

适合以下场景：

- 需要保留导航栏
- 需要双栏结构
- 需要较强的信息分区

最小起步方式：

1. 复制 `GlassResumeWebPage.astro`
2. 复制 `GlassResumePrintPage.astro`
3. 替换 CSS 引用
4. 按新样式目标逐步删除不需要的装饰和结构

### 推荐起点二：从 `editorial` 开始

适合以下场景：

- 需要单栏阅读
- 需要更像文章或作品集的排版节奏
- 需要更弱的导航感，更强的阅读感

## 样式组件的职责边界

新增样式时，建议遵循以下边界。

### 样式组件应该负责什么

- 页面整体布局
- 头部信息如何组织
- section 如何排列
- 是否分栏
- 区块的视觉层级和信息密度
- 特定区块的专用渲染方式

例如，当前项目中：

- `glass` 样式会根据 `layout` 将区块拆分为主栏和侧栏
- `editorial` 样式则更接近单栏顺序渲染

### 样式组件不应该负责什么

- 读取某份简历目录以外的数据
- 改写内容源本身
- 在样式组件内部硬编码某份具体简历的文本

样式组件应当消费的输入只有：

- `hero`
- `sections`
- `navItems`
- `primarySection`
- `kicker`
- `printHref`

## `layout` 字段的正确用法

每个 section 都可能携带：

- `layout: full`
- `layout: compact`

它的作用是为样式提供展示提示，而不是强制布局。

推荐理解方式：

- `full`
  主内容块。通常更适合大面积正文，例如工作经历、项目经历。
- `compact`
  辅助信息块。通常更适合技能、教育、证书、补充信息。

新增样式时，可以选择：

- 使用这个提示
- 忽略这个提示
- 将它映射成自己的布局语义

但不建议在 `src/lib/resume.ts` 中重新写死“哪个 slug 必须进哪一栏”。这是样式层的职责。

## CSS 作用域要求

本项目已经出现过多主题互相污染的问题，因此新增样式时必须进行作用域隔离。

### 推荐做法

1. 在样式页面组件的 `<body>` 上添加唯一类名
2. 样式文件中的主题规则以该类名为前缀

示例：

```astro
<body class="minimal-web-body">
```

```css
body.minimal-web-body {
  background: #f7f7f5;
  color: #1a1a1a;
}

body.minimal-web-body .profile-meta-grid-web {
  grid-template-columns: 1fr;
}
```

打印页同理：

```astro
<body class="minimal-print-body">
```

```css
body.minimal-print-body .print-sheet {
  background: #fff;
}
```

### 不推荐做法

避免在样式文件中直接写这类无作用域的公共规则：

```css
html { ... }
body { ... }
.profile-meta-grid-web { ... }
.print-section-header { ... }
```

原因是：

- 多套样式会被同时打包进项目
- 无作用域的公共选择器很容易覆盖其他样式
- Web 与 Print 都会受到影响

## 建议复用的共享组件

项目中已有一些共享组件，新增样式时可以优先复用：

- `src/components/ProfileMetaGrid.astro`
  联系方式网格
- `src/components/PrintSection.astro`
  打印区块包装
- `src/components/PrintSkillsSection.astro`
  打印技能分组渲染
- `src/lib/resume-skill-groups.ts`
  技能 Markdown 分组解析

如果新样式只需要改变外层结构，可以继续使用这些共享能力，而不需要重复实现。

## 最小实现示例

下面给出一个最小的 `MinimalResumeWebPage.astro` 结构示例：

```astro
---
import ProfileMetaGrid from '../../ProfileMetaGrid.astro';
import '../../../styles/resume-themes/minimal-web.css';

const { hero, sections, kicker, printHref } = Astro.props;
---

<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>{hero.data.title} | 简历</title>
  </head>
  <body class="minimal-web-body">
    <main class="minimal-page">
      <header class="minimal-hero">
        <p>{kicker}</p>
        <h1>{hero.data.title}</h1>
        {hero.data.subtitle && <p>{hero.data.subtitle}</p>}
        <ProfileMetaGrid contacts={hero.data.contacts} variant="web" />
        <a href={printHref}>打印版 / PDF</a>
      </header>

      {
        sections.map((section) => (
          <section id={section.data.sectionSlug}>
            <h2>{section.data.title}</h2>
            <section.Content />
          </section>
        ))
      }
    </main>
  </body>
</html>
```

这个版本足够让新样式先运行起来，再逐步细化视觉与布局。

## 验证步骤

新增样式后，建议至少完成以下验证：

1. 将某份简历的 `_meta.md` 改为新 `styleId`
2. 执行 `npm run build`
3. 打开该简历的 Web 页面
4. 打开该简历的打印页面
5. 检查联系方式区域是否溢出
6. 检查 `skills` 区块是否需要专门渲染
7. 检查样式是否污染其他主题

## 常见问题

### 改了 `_meta.md` 里的 `styleId` 但构建失败

通常是因为新 `styleId` 尚未加入 `src/lib/resume-style-catalog.ts`，导致内容 schema 校验失败。

### 新样式没有生效

优先检查：

1. `ResumeStyleRenderer.astro` 是否导入并注册了新组件
2. `_meta.md` 中的 `styleId` 是否拼写一致
3. 构建缓存是否已刷新

### 样式之间互相覆盖

说明 CSS 作用域不够严格。优先检查是否使用了：

- 无前缀的 `html`
- 无前缀的 `body`
- 无前缀的公共类选择器

### 某个区块在新样式中表现很差

不要立刻修改内容源。优先考虑：

- 为该区块加专用渲染组件
- 在样式组件中对 `sectionSlug` 做条件渲染
- 复用已有解析函数，例如 `parseResumeSkillGroups()`

## 结论

新增样式的最小必要步骤只有四项：

1. 在 `resume-style-catalog.ts` 注册新 `styleId`
2. 创建新的 Web / Print Astro 组件
3. 在 `ResumeStyleRenderer.astro` 中接入新样式
4. 在目标简历的 `_meta.md` 中指定该 `styleId`

除此之外，建议优先做好 CSS 作用域隔离与打印页适配。这两点决定了新样式是否能够长期稳定维护。
