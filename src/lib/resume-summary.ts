export type ResumeSummary = string | string[] | null | undefined;

export function normalizeResumeSummary(summary: ResumeSummary): string[] {
  if (summary == null) {
    return [];
  }

  if (Array.isArray(summary)) {
    return summary
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  const value = summary.trim();
  return value ? [value] : [];
}

export function joinResumeSummary(
  summary: ResumeSummary,
  separator = ' ',
): string | undefined {
  const parts = normalizeResumeSummary(summary);
  return parts.length > 0 ? parts.join(separator) : undefined;
}
