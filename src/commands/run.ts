import type { SkillManager } from '../core/SkillManager.js';
import { logger } from '../utils/logger.js';

export interface RunOptions {
  script?: string;
}

export async function runRun(
  manager: SkillManager,
  name: string,
  options: RunOptions,
  args: string[],
): Promise<number> {
  try {
    const result = await manager.run(name, options.script, args, {
      inheritStdio: true,
    });
    return result.exitCode;
  } catch (err) {
    logger.error((err as Error).message);
    return 1;
  }
}
