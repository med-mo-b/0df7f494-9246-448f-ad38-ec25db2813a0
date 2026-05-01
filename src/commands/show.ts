import { promises as fs } from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';

import type { SkillManager } from '../core/SkillManager.js';
import { logger } from '../utils/logger.js';

export async function runShow(
  manager: SkillManager,
  name: string,
): Promise<number> {
  const matches = await manager.getAll(name);
  if (matches.length === 0) {
    logger.error(`skill not found: ${name}`);
    return 1;
  }

  if (matches.length > 1) {
    process.stderr.write(
      pc.yellow(
        `note: skill "${name}" found in multiple scopes (${matches
          .map((m) => m.scope)
          .join(', ')}); showing the first.\n`,
      ),
    );
  }

  const skill = matches[0]!;
  const skillFile = path.join(skill.rootPath, 'SKILL.md');
  const raw = await fs.readFile(skillFile, 'utf8');
  process.stdout.write(raw);
  if (!raw.endsWith('\n')) process.stdout.write('\n');
  return 0;
}
