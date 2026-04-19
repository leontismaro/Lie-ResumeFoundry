export const resumeStyleIds = ['glass', 'editorial'] as const;

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
] as const;

export type ResumeStyleDefinition = (typeof resumeStyleCatalog)[number];
export type ResumeStyleId = (typeof resumeStyleIds)[number];

export function getResumeStyleCatalog() {
  return resumeStyleCatalog;
}

export function getResumeStyleDefinition(styleId: string | undefined) {
  return resumeStyleCatalog.find((style) => style.id === styleId) ?? null;
}
