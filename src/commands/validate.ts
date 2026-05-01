import pc from 'picocolors';

import type { SkillManager } from '../core/SkillManager.js';

export interface ValidateOptions {
  json?: boolean;
}

export async function runValidate(
  manager: SkillManager,
  rootPath: string,
  options: ValidateOptions,
): Promise<number> {
  const result = await manager.validate(rootPath);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  }

  if (result.ok) {
    process.stdout.write(`${pc.green('ok')} ${rootPath}\n`);
    return 0;
  }
  process.stdout.write(`${pc.red('invalid')} ${rootPath}\n`);
  for (const issue of result.issues) {
    const where = issue.path ? ` ${pc.dim(`(${issue.path})`)}` : '';
    process.stdout.write(`  - [${issue.code}] ${issue.message}${where}\n`);
  }
  return 1;
}
