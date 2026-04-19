import { getCollection } from 'astro:content';
import type { ResumeStyleId } from './resume-style-catalog';

const resumeContentPathPrefix = 'src/content/resumes/';

export type ResumeId = string;

export type ResumeDefinition = {
  id: ResumeId;
  kicker: string;
  label: string;
  summary: string;
  listed: boolean;
  isDefault: boolean;
  isMaster: boolean;
  styleId: ResumeStyleId;
  order: number;
};

function getResumeIdFromFilePath(filePath: string | undefined) {
  if (!filePath?.startsWith(resumeContentPathPrefix)) {
    throw new Error(`无法从文件路径识别简历目录: ${filePath ?? 'unknown'}`);
  }

  const [resumeId] = filePath.slice(resumeContentPathPrefix.length).split('/');

  if (!resumeId) {
    throw new Error(`简历目录缺少 resumeId: ${filePath}`);
  }

  return resumeId;
}

function assertSingleResumeFlag(resumes: ResumeDefinition[], flag: 'isDefault' | 'isMaster') {
  const matches = resumes.filter((resume) => resume[flag]);

  if (matches.length !== 1) {
    throw new Error(`resume 元数据配置错误: ${flag} 需要且只能有一个。`);
  }

  return matches[0];
}

export async function getResumeCatalog() {
  const metaEntries = await getCollection('resume', ({ data }) => data.kind === 'meta');

  return metaEntries
    .map((entry) => ({
      id: getResumeIdFromFilePath(entry.filePath),
      kicker: entry.data.kicker,
      label: entry.data.label,
      summary: entry.data.summary,
      listed: entry.data.listed,
      isDefault: entry.data.isDefault,
      isMaster: entry.data.isMaster,
      styleId: entry.data.styleId,
      order: entry.data.order,
    }))
    .sort((left, right) => left.order - right.order);
}

export async function getListedResumeCatalog() {
  return (await getResumeCatalog()).filter((resume) => resume.listed);
}

export async function getResumeDefinition(resumeId: string | undefined) {
  return (await getResumeCatalog()).find((resume) => resume.id === resumeId) ?? null;
}

export async function getDefaultResumeDefinition() {
  return assertSingleResumeFlag(await getResumeCatalog(), 'isDefault');
}

export async function getMasterResumeDefinition() {
  return assertSingleResumeFlag(await getResumeCatalog(), 'isMaster');
}

export function getResumePath(
  resumeId: ResumeId,
  options: {
    print?: boolean;
    preferMasterRoot?: boolean;
    isMaster?: boolean;
  } = {},
) {
  const { preferMasterRoot = false, print = false, isMaster = false } = options;

  if (preferMasterRoot && isMaster) {
    return print ? '/print' : '/';
  }

  return print ? `/resume/${resumeId}/print` : `/resume/${resumeId}`;
}
