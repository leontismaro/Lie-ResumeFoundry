export interface ResumeSkillGroup {
  name: string;
  items: string[];
}

export function parseResumeSkillGroups(body = ''): ResumeSkillGroup[] {
  const groups: ResumeSkillGroup[] = [];
  const lines = body.split('\n');
  let currentGroup: ResumeSkillGroup | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (line.startsWith('### ')) {
      if (currentGroup) {
        groups.push(currentGroup);
      }

      currentGroup = {
        name: line.slice(4).trim(),
        items: [],
      };
      continue;
    }

    if (line.startsWith('- ') && currentGroup) {
      currentGroup.items.push(line.slice(2).trim());
    }
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}
