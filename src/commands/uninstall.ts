import pc from 'picocolors';

import type { SkillManager } from '../core/SkillManager.js';
import type { SkillScope } from '../types/Skill.js';
import { logger } from '../utils/logger.js';

export interface UninstallOptions {
  scope: Exclude<SkillScope, 'system'>;
}

export async function runUninstall(
  manager: SkillManager,
  name: string,
  options: UninstallOptions,
): Promise<number> {
  const removed = await manager.uninstall(name, options.scope);
  if (!removed) {
    logger.error(`skill not installed in scope "${options.scope}": ${name}`);
    return 1;
  }
  process.stdout.write(
    `${pc.green('uninstalled')} ${pc.bold(name)} ${pc.dim(`[${options.scope}]`)}\n`,
  );
  return 0;
}
