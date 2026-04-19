import { getCollection, render } from 'astro:content';
import type { ResumeId } from './resume-catalog';
import type { ResumeStyleId } from './resume-style-catalog';

async function getResumeEntries(resumeId: ResumeId) {
  return (
    await getCollection('resume', ({ filePath }) =>
      filePath?.startsWith(`src/content/resumes/${resumeId}/`),
    )
  ).sort((left, right) => {
    const leftOrder = 'order' in left.data ? left.data.order : Number.POSITIVE_INFINITY;
    const rightOrder = 'order' in right.data ? right.data.order : Number.POSITIVE_INFINITY;

    return leftOrder - rightOrder;
  });
}

function getResumeMetaEntry(entries: Awaited<ReturnType<typeof getResumeEntries>>) {
  const metaEntries = entries.filter((entry) => entry.data.kind === 'meta');

  if (metaEntries.length !== 1) {
    throw new Error(`简历元数据配置错误: ${entries[0]?.filePath ?? 'unknown'}`);
  }

  return metaEntries[0];
}

function getResumeHeroEntry(entries: Awaited<ReturnType<typeof getResumeEntries>>) {
  const heroEntries = entries.filter((entry) => entry.data.kind === 'hero');

  if (heroEntries.length !== 1) {
    throw new Error(`简历 hero 配置错误: ${entries[0]?.filePath ?? 'unknown'}`);
  }

  return heroEntries[0];
}

export async function loadResumeContent(resumeId: ResumeId) {
  const entries = await getResumeEntries(resumeId);

  if (entries.length === 0) {
    throw new Error(`未找到 resume 内容: ${resumeId}`);
  }

  const renderedEntries = await Promise.all(
    entries.map(async (entry) => {
      const { Content } = await render(entry);

      return {
        ...entry,
        Content,
      };
    }),
  );

  const hero = getResumeHeroEntry(renderedEntries);
  const meta = getResumeMetaEntry(renderedEntries);
  const hiddenSectionSlugs = new Set(meta.data.hiddenSectionSlugs);
  const sections = renderedEntries
    .filter((entry) => entry.data.kind === 'section')
    .filter(
      (section) => !section.data.hidden && !hiddenSectionSlugs.has(section.data.sectionSlug),
    );

  const navItems = sections.map((section) => ({
    href: `#${section.data.sectionSlug}`,
    label: section.data.title,
  }));

  const primarySection = sections.find((section) => section.data.layout === 'full') ?? sections[0] ?? null;

  return {
    definition: {
      id: resumeId,
      kicker: meta.data.kicker,
      label: meta.data.label,
      summary: meta.data.summary,
      listed: meta.data.listed,
      isDefault: meta.data.isDefault,
      isMaster: meta.data.isMaster,
      styleId: meta.data.styleId as ResumeStyleId,
      order: meta.data.order,
    },
    hero,
    styleId: meta.data.styleId as ResumeStyleId,
    sections,
    navItems,
    primarySection,
  };
}
