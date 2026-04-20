import { getCollection, render, type CollectionEntry } from 'astro:content';
import type { ResumeId } from './resume-catalog';
import type { ResumeStyleId } from './resume-style-catalog';

type ResumeEntry = CollectionEntry<'resume'>;
type ResumeMetaEntry = ResumeEntry & {
  data: {
    hiddenSectionSlugs: string[];
    isDefault: boolean;
    isMaster: boolean;
    kicker: string;
    kind: 'meta';
    label: string;
    listed: boolean;
    order: number;
    styleId: ResumeStyleId;
    summary: string;
  };
};
type ResumeHeroEntry = ResumeEntry & {
  data: {
    kind: 'hero';
    layout: 'full' | 'compact';
    order: number;
    sectionSlug: string;
    title: string;
  };
};
type ResumeSectionEntry = ResumeEntry & {
  data: {
    hidden: boolean;
    kind: 'section';
    layout: 'full' | 'compact';
    order: number;
    sectionSlug: string;
    title: string;
  };
};
type RenderedResumeEntry = ResumeEntry & {
  Content: Awaited<ReturnType<typeof render>>['Content'];
};
type RenderedResumeMetaEntry = ResumeMetaEntry & RenderedResumeEntry;
type RenderedResumeHeroEntry = ResumeHeroEntry & RenderedResumeEntry;
type RenderedResumeSectionEntry = ResumeSectionEntry & RenderedResumeEntry;

function isResumeMetaEntry(entry: ResumeEntry): entry is ResumeMetaEntry {
  return entry.data.kind === 'meta';
}

function isResumeHeroEntry(entry: ResumeEntry): entry is ResumeHeroEntry {
  return entry.data.kind === 'hero';
}

function isResumeSectionEntry(entry: ResumeEntry): entry is ResumeSectionEntry {
  return entry.data.kind === 'section';
}

function isRenderedResumeMetaEntry(entry: RenderedResumeEntry): entry is RenderedResumeMetaEntry {
  return entry.data.kind === 'meta';
}

function isRenderedResumeHeroEntry(entry: RenderedResumeEntry): entry is RenderedResumeHeroEntry {
  return entry.data.kind === 'hero';
}

function isRenderedResumeSectionEntry(entry: RenderedResumeEntry): entry is RenderedResumeSectionEntry {
  return entry.data.kind === 'section';
}

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
  const metaEntries = entries.filter(isResumeMetaEntry);

  if (metaEntries.length !== 1) {
    throw new Error(`简历元数据配置错误: ${entries[0]?.filePath ?? 'unknown'}`);
  }

  return metaEntries[0];
}

function getResumeHeroEntry(entries: Awaited<ReturnType<typeof getResumeEntries>>) {
  const heroEntries = entries.filter(isResumeHeroEntry);

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
  ) satisfies RenderedResumeEntry[];

  const heroEntries = renderedEntries.filter(isRenderedResumeHeroEntry);
  const metaEntries = renderedEntries.filter(isRenderedResumeMetaEntry);

  if (heroEntries.length !== 1) {
    throw new Error(`简历 hero 配置错误: ${entries[0]?.filePath ?? 'unknown'}`);
  }

  if (metaEntries.length !== 1) {
    throw new Error(`简历元数据配置错误: ${entries[0]?.filePath ?? 'unknown'}`);
  }

  const hero = heroEntries[0];
  const meta = metaEntries[0];
  const hiddenSectionSlugs = new Set(meta.data.hiddenSectionSlugs);
  const sections = renderedEntries
    .filter(isRenderedResumeSectionEntry)
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
