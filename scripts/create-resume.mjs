#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const RESUME_ROOT = path.resolve(process.cwd(), 'src/content/resumes');

function printUsage() {
  console.log(`用法:
  npm run create-resume -- --id <resume-id> [选项]

必填:
  --id <resume-id>           新简历目录名，建议使用 kebab-case

可选:
  --label <文本>             简历名称，默认从 id 推导
  --kicker <文本>            简历副标题，默认 Custom / Targeted Resume
  --summary <文本>           列表摘要，默认请补充摘要
  --style <style-id>         样式 id，默认 glass
  --source <resume-id>       从现有简历复制正文内容
  --order <数字>             显示顺序，默认追加到最后
  --listed [true|false]      是否出现在 /resumes，默认 true
  --default [true|false]     是否设为默认简历，默认 false
  --master [true|false]      是否设为主简历，默认 false
  --help                     查看帮助

示例:
  npm run create-resume -- --id ml-platform
  npm run create-resume -- --id staff-backend --label "Staff 后端版" --source master
  npm run create-resume -- --id infra --style editorial --listed false`);
}

function parseBoolean(value, flagName) {
  if (value === undefined) {
    return true;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new Error(`${flagName} 只接受 true 或 false。`);
}

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      throw new Error(`无法识别的参数: ${token}`);
    }

    const flag = token.slice(2);
    const next = argv[index + 1];
    const hasValue = next !== undefined && !next.startsWith('--');

    switch (flag) {
      case 'help':
        options.help = true;
        break;
      case 'id':
      case 'label':
      case 'kicker':
      case 'summary':
      case 'style':
      case 'source':
      case 'order':
        if (!hasValue) {
          throw new Error(`参数 --${flag} 缺少值。`);
        }
        options[flag] = next;
        index += 1;
        break;
      case 'listed':
      case 'default':
      case 'master':
        options[flag] = parseBoolean(hasValue ? next : undefined, `--${flag}`);
        if (hasValue) {
          index += 1;
        }
        break;
      default:
        throw new Error(`不支持的参数: --${flag}`);
    }
  }

  return options;
}

function toTitleCase(text) {
  return text
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function escapeYamlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function assertResumeId(id) {
  if (!id) {
    throw new Error('缺少必填参数 --id。');
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`resume id 不合法: ${id}。请使用 kebab-case。`);
  }
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readExistingResumeMeta() {
  const directories = await fs.readdir(RESUME_ROOT, { withFileTypes: true });
  const resumes = [];

  for (const entry of directories) {
    if (!entry.isDirectory()) {
      continue;
    }

    const metaPath = path.join(RESUME_ROOT, entry.name, '_meta.md');

    if (!(await pathExists(metaPath))) {
      continue;
    }

    const content = await fs.readFile(metaPath, 'utf8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) {
      throw new Error(`元数据文件格式错误: ${metaPath}`);
    }

    const fields = {};

    for (const line of frontmatterMatch[1].split('\n')) {
      const match = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);

      if (!match) {
        continue;
      }

      const [, key, rawValue] = match;
      fields[key] = rawValue.trim();
    }

    resumes.push({
      id: entry.name,
      order: Number(fields.order ?? Number.NaN),
      isDefault: fields.isDefault === 'true',
      isMaster: fields.isMaster === 'true',
    });
  }

  return resumes;
}

function buildMetaContent({
  label,
  kicker,
  summary,
  listed,
  isDefault,
  isMaster,
  styleId,
  order,
}) {
  return `---
kind: meta
label: ${escapeYamlString(label)}
kicker: ${escapeYamlString(kicker)}
summary: ${escapeYamlString(summary)}
listed: ${listed}
isDefault: ${isDefault}
isMaster: ${isMaster}
styleId: ${styleId}
order: ${order}
---
`;
}

function buildProfileContent(label) {
  return `---
title: ${escapeYamlString('请填写姓名')}
subtitle: ${escapeYamlString(label)}
summary: ${escapeYamlString('请补充这份简历版本的定位摘要。')}
sectionSlug: profile
contacts:
  - label: 邮箱
    value: your.email@example.com
    href: mailto:your.email@example.com
  - label: 电话
    value: +86 138-0000-0000
  - label: GitHub
    value: github.com/your-name
    href: https://github.com/your-name
  - label: 地点
    value: Shanghai, China
kind: hero
layout: full
order: 0
---

请补充这份简历版本的个人介绍，说明它面向的岗位方向、能力重点和交付优势。
`;
}

function buildSectionContent({ title, summary, sectionSlug, layout, order, body }) {
  return `---
title: ${escapeYamlString(title)}
summary: ${escapeYamlString(summary)}
sectionSlug: ${sectionSlug}
kind: section
layout: ${layout}
order: ${order}
---

${body}
`;
}

function buildSkeletonFiles(label) {
  return new Map([
    ['00-profile.md', buildProfileContent(label)],
    [
      '01-experience.md',
      buildSectionContent({
        title: '工作经历',
        summary: '请补充与这份简历方向最相关的工作经历。',
        sectionSlug: 'experience',
        layout: 'full',
        order: 1,
        body: `### 公司 / 团队名称

**职位名称** | 2021.01 - 至今

- 补充职责范围、业务场景和团队背景。
- 补充关键项目、复杂问题和量化结果。
`,
      }),
    ],
    [
      '02-projects.md',
      buildSectionContent({
        title: '项目经历',
        summary: '请补充最能体现岗位匹配度的项目。',
        sectionSlug: 'projects',
        layout: 'full',
        order: 2,
        body: `### 项目名称

一句话描述项目目标、用户对象或业务背景。

- 补充你负责的核心模块和关键决策。
- 补充产出结果、性能指标或业务影响。
`,
      }),
    ],
    [
      '03-skills.md',
      buildSectionContent({
        title: '技能栈',
        summary: '请按能力方向整理技能栈。',
        sectionSlug: 'skills',
        layout: 'compact',
        order: 3,
        body: `### 方向一

- 技能 A
- 技能 B
- 技能 C

### 方向二

- 技能 D
- 技能 E
- 技能 F
`,
      }),
    ],
    [
      '04-education.md',
      buildSectionContent({
        title: '教育与资质',
        summary: '请补充教育背景、证书或培训经历。',
        sectionSlug: 'education',
        layout: 'compact',
        order: 4,
        body: `### 教育背景

**学校名称**  
专业 / 学位  
2015.09 - 2019.06

### 资质证书

**证书名称**  
颁发机构  
年份
`,
      }),
    ],
  ]);
}

async function copySourceFiles(sourceId, targetDir) {
  const sourceDir = path.join(RESUME_ROOT, sourceId);

  if (!(await pathExists(sourceDir))) {
    throw new Error(`找不到 source 简历目录: ${sourceId}`);
  }

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== '_meta.md')
    .map((entry) => entry.name)
    .sort();

  if (markdownFiles.length === 0) {
    throw new Error(`source 简历目录没有可复制的 Markdown 文件: ${sourceId}`);
  }

  for (const fileName of markdownFiles) {
    await fs.copyFile(path.join(sourceDir, fileName), path.join(targetDir, fileName));
  }

  return markdownFiles;
}

async function writeSkeletonFiles(targetDir, label) {
  const files = buildSkeletonFiles(label);

  for (const [fileName, content] of files) {
    await fs.writeFile(path.join(targetDir, fileName), content, 'utf8');
  }

  return [...files.keys()];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  assertResumeId(options.id);

  const resumeId = options.id;
  const label = options.label ?? toTitleCase(resumeId);
  const kicker = options.kicker ?? 'Custom / Targeted Resume';
  const summary = options.summary ?? '请补充这份简历版本的用途和能力重点。';
  const styleId = options.style ?? 'glass';
  const listed = options.listed ?? true;
  const isDefault = options.default ?? false;
  const isMaster = options.master ?? false;

  const existingResumes = await readExistingResumeMeta();

  if (existingResumes.some((resume) => resume.id === resumeId)) {
    throw new Error(`目标简历目录已存在: ${resumeId}`);
  }

  if (isDefault && existingResumes.some((resume) => resume.isDefault)) {
    throw new Error('当前项目已经存在默认简历。请先手动调整已有 _meta.md，再创建新的默认简历。');
  }

  if (isMaster && existingResumes.some((resume) => resume.isMaster)) {
    throw new Error('当前项目已经存在主简历。请先手动调整已有 _meta.md，再创建新的主简历。');
  }

  const maxOrder = existingResumes.reduce(
    (currentMax, resume) => (Number.isFinite(resume.order) ? Math.max(currentMax, resume.order) : currentMax),
    -1,
  );
  const order = options.order !== undefined ? Number(options.order) : maxOrder + 1;

  if (!Number.isInteger(order) || order < 0) {
    throw new Error(`order 必须是大于等于 0 的整数，当前值: ${options.order}`);
  }

  const targetDir = path.join(RESUME_ROOT, resumeId);

  await fs.mkdir(targetDir);

  const fileNames = options.source
    ? await copySourceFiles(options.source, targetDir)
    : await writeSkeletonFiles(targetDir, label);

  await fs.writeFile(
    path.join(targetDir, '_meta.md'),
    buildMetaContent({
      label,
      kicker,
      summary,
      listed,
      isDefault,
      isMaster,
      styleId,
      order,
    }),
    'utf8',
  );

  console.log(`已创建简历: ${resumeId}`);
  console.log(`目录: src/content/resumes/${resumeId}`);
  console.log(`样式: ${styleId}`);
  console.log(`顺序: ${order}`);
  console.log(`来源: ${options.source ? `复制自 ${options.source}` : '空白骨架'}`);
  console.log('文件:');

  for (const fileName of ['_meta.md', ...fileNames]) {
    console.log(`- ${fileName}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
