import pc from 'picocolors';

import type { SkillManager } from '../core/SkillManager.js';
import type { Skill, SkillScope } from '../types/Skill.js';

export interface ListOptions {
  scope?: SkillScope | 'all';
  json?: boolean;
}

export async function runList(
  manager: SkillManager,
  options: ListOptions,
): Promise<number> {
  const all = await manager.discover();
  const filtered = filterByScope(all, options.scope);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(filtered, null, 2)}\n`);
    return 0;
  }

  if (filtered.length === 0) {
    process.stdout.write('No skills found.\n');
    return 0;
  }

  for (const skill of filtered) {
    process.stdout.write(
      `${pc.bold(skill.name)} ${pc.dim(`[${skill.scope}]`)} -- ${skill.description}\n`,
    );
    process.stdout.write(`  ${pc.dim(skill.rootPath)}\n`);
  }
  return 0;
}

function filterByScope(
  skills: Skill[],
  scope: ListOptions['scope'],
): Skill[] {
  if (!scope || scope === 'all') return skills;
  return skills.filter((s) => s.scope === scope);
}
