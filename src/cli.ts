import { Command } from 'commander';

import { runInstall } from './commands/install.js';
import { runList } from './commands/list.js';
import { runRun } from './commands/run.js';
import { runSearch } from './commands/search.js';
import { runShow } from './commands/show.js';
import { runUninstall } from './commands/uninstall.js';
import { runValidate } from './commands/validate.js';
import { SkillManager } from './core/SkillManager.js';
import type { SkillScope } from './types/Skill.js';
import { logger } from './utils/logger.js';

const VALID_SCOPES = new Set<SkillScope | 'all'>([
  'repo',
  'user',
  'admin',
  'system',
  'all',
]);

const VALID_INSTALL_SCOPES = new Set<Exclude<SkillScope, 'system'>>([
  'repo',
  'user',
  'admin',
]);

function parseScope(value: string): SkillScope | 'all' {
  if (!VALID_SCOPES.has(value as SkillScope | 'all')) {
    throw new Error(
      `invalid scope: ${value} (expected: repo, user, admin, system, all)`,
    );
  }
  return value as SkillScope | 'all';
}

function parseInstallScope(value: string): Exclude<SkillScope, 'system'> {
  if (!VALID_INSTALL_SCOPES.has(value as Exclude<SkillScope, 'system'>)) {
    throw new Error(
      `invalid install scope: ${value} (expected: repo, user, admin)`,
    );
  }
  return value as Exclude<SkillScope, 'system'>;
}

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function collect(value: string, prev: string[] = []): string[] {
  return [...prev, value];
}

function parseLimit(value: string): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`--limit must be a positive integer, got: ${value}`);
  }
  return n;
}

export function buildCli(): Command {
  const program = new Command();

  program
    .name('skill')
    .description(
      'Discover, install, validate, and run Agent Skills locally.',
    )
    .version('0.1.0')
    .showHelpAfterError();

  program
    .command('list')
    .description('List installed skills')
    .option('--scope <scope>', 'Filter by scope (repo, user, admin, all)', parseScope, 'all')
    .option('--json', 'Print as JSON', false)
    .action(async (options: { scope: SkillScope | 'all'; json: boolean }) => {
      const code = await runList(new SkillManager(), {
        scope: options.scope,
        json: options.json,
      });
      process.exit(code);
    });

  program
    .command('show <name>')
    .description('Print a skill\'s SKILL.md to stdout')
    .action(async (name: string) => {
      const code = await runShow(new SkillManager(), name);
      process.exit(code);
    });

  program
    .command('install <source>')
    .description(
      'Install a skill from a local path or git URL. ' +
        '<source> may be a directory or a https/ssh git URL.',
    )
    .option(
      '--scope <scope>',
      'Install location (repo, user, admin)',
      parseInstallScope,
      'user',
    )
    .option('--ref <git-ref>', 'Git branch, tag, or sha (git sources only)')
    .option('--subdir <path>', 'Skill subdir within the source')
    .option('--force', 'Overwrite an existing skill at the destination', false)
    .action(
      async (
        source: string,
        options: {
          scope: Exclude<SkillScope, 'system'>;
          ref?: string;
          subdir?: string;
          force: boolean;
        },
      ) => {
        const installOpts: Parameters<typeof runInstall>[2] = {
          scope: options.scope,
          force: options.force,
        };
        if (options.ref) installOpts.ref = options.ref;
        if (options.subdir) installOpts.subdir = options.subdir;
        const code = await runInstall(new SkillManager(), source, installOpts);
        process.exit(code);
      },
    );

  program
    .command('uninstall <name>')
    .description('Remove an installed skill')
    .option(
      '--scope <scope>',
      'Scope to remove from (repo, user, admin)',
      parseInstallScope,
      'user',
    )
    .action(
      async (
        name: string,
        options: { scope: Exclude<SkillScope, 'system'> },
      ) => {
        const code = await runUninstall(new SkillManager(), name, {
          scope: options.scope,
        });
        process.exit(code);
      },
    );

  program
    .command('run <name> [script]')
    .description(
      'Execute a script inside a skill. If [script] is omitted and the skill ' +
        'has exactly one script, it is used.',
    )
    .allowExcessArguments(true)
    .allowUnknownOption(true)
    .action(async (name: string, script: string | undefined, _opts, cmd) => {
      // Anything after `--` is forwarded to the script.
      const passthrough = cmd.args.slice(script ? 2 : 1);
      const runOpts: Parameters<typeof runRun>[2] = {};
      if (script) runOpts.script = script;
      const code = await runRun(new SkillManager(), name, runOpts, passthrough);
      process.exit(code);
    });

  program
    .command('search')
    .description('Run the configured SearchProvider against local files')
    .requiredOption('--query <text>', 'Search query (free-form keywords)')
    .option('--path <dir>', 'Root directory (repeatable)', collect, [])
    .option('--ext <list>', 'Comma-separated file extensions to include', parseCsv)
    .option('--limit <n>', 'Maximum number of hits', parseLimit, 10)
    .option('--provider <name>', 'Search backend (default: lexical)', 'lexical')
    .option('--json', 'Print as JSON', false)
    .action(
      async (options: {
        query: string;
        path: string[];
        ext?: string[];
        limit: number;
        provider: string;
        json: boolean;
      }) => {
        const searchOpts: Parameters<typeof runSearch>[0] = {
          query: options.query,
          paths: options.path,
          limit: options.limit,
          provider: options.provider,
          json: options.json,
        };
        if (options.ext) searchOpts.extensions = options.ext;
        const code = await runSearch(searchOpts);
        process.exit(code);
      },
    );

  program
    .command('validate <path>')
    .description('Validate a skill directory against the agentskills.io spec')
    .option('--json', 'Print as JSON', false)
    .action(async (rootPath: string, options: { json: boolean }) => {
      const code = await runValidate(new SkillManager(), rootPath, {
        json: options.json,
      });
      process.exit(code);
    });

  return program;
}

async function main(): Promise<void> {
  const cli = buildCli();
  try {
    await cli.parseAsync(process.argv);
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }
}

main();
