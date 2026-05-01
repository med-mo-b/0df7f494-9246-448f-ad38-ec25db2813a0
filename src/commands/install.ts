import pc from 'picocolors';

import type { SkillManager } from '../core/SkillManager.js';
import { InstallError, type InstallSource, type SkillScope } from '../types/Skill.js';
import { logger } from '../utils/logger.js';

export interface InstallOptions {
  scope: Exclude<SkillScope, 'system'>;
  ref?: string;
  subdir?: string;
  force?: boolean;
}

export async function runInstall(
  manager: SkillManager,
  source: string,
  options: InstallOptions,
): Promise<number> {
  const installSource = parseSource(source, options.ref, options.subdir);
  try {
    const installed = await manager.install(installSource, options.scope, {
      force: options.force ?? false,
    });
    process.stdout.write(
      `${pc.green('installed')} ${pc.bold(installed.name)} ` +
        `${pc.dim(`[${installed.scope}]`)} -> ${installed.rootPath}\n`,
    );
    return 0;
  } catch (err) {
    if (err instanceof InstallError) {
      logger.error(`install failed: ${err.message}`);
      return 1;
    }
    throw err;
  }
}

function parseSource(
  source: string,
  ref: string | undefined,
  subdir: string | undefined,
): InstallSource {
  const looksLikeGit =
    /^https?:\/\//i.test(source) ||
    /^git@/i.test(source) ||
    /^ssh:\/\//i.test(source) ||
    source.endsWith('.git');

  const base: InstallSource = {
    kind: looksLikeGit ? 'git' : 'local',
    value: source,
  };
  if (ref) base.ref = ref;
  if (subdir) base.subdir = subdir;
  return base;
}
