import { spawn, type SpawnOptions } from 'node:child_process';
import path from 'node:path';

import type {
  ExecResult,
  ScriptLanguage,
  Skill,
  SkillScript,
} from '../types/Skill.js';

export interface ExecOptions {
  /**
   * If `true`, child stdio is inherited from the parent (CLI mode).
   * If `false` (default), stdio is captured and returned in the result.
   */
  inheritStdio?: boolean;
  /** Extra env vars to merge with `process.env`. */
  env?: Record<string, string>;
  /** Working directory for the child. Defaults to the skill's rootPath. */
  cwd?: string;
}

/**
 * Spawns scripts that live inside a skill's `scripts/` directory.
 *
 * Interpreter selection is driven by the script's language tag
 * (set by `SkillLoader` from the file extension):
 *   - node   -> `node <script>`
 *   - python -> `python3 <script>` (or `python` on Windows)
 *   - bash   -> `bash <script>`
 *   - unknown-> the file is invoked directly (must be executable)
 */
export class SkillExecutor {
  async run(
    skill: Skill,
    scriptName: string | undefined,
    args: string[] = [],
    options: ExecOptions = {},
  ): Promise<ExecResult> {
    const script = pickScript(skill, scriptName);
    if (!script) {
      throw new Error(buildPickErrorMessage(skill, scriptName));
    }

    const interpreter = resolveInterpreter(script);
    if (!interpreter.command) {
      throw new Error(
        `Skill "${skill.name}" script "${script.name}" has unknown language; ` +
          `add a recognized extension (.mjs/.js/.cjs, .py, .sh).`,
      );
    }
    const { command, prefixArgs } = interpreter;
    const cwd = options.cwd ?? skill.rootPath;
    const env = { ...process.env, ...(options.env ?? {}) };

    const spawnOptions: SpawnOptions = {
      cwd,
      env,
      stdio: options.inheritStdio ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    };

    const startedAt = Date.now();
    return await new Promise<ExecResult>((resolve, reject) => {
      const child = spawn(
        command,
        [...prefixArgs, script.path, ...args],
        spawnOptions,
      );

      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });

      child.on('error', (err) => reject(err));
      child.on('close', (code) => {
        resolve({
          exitCode: code ?? 0,
          stdout,
          stderr,
          durationMs: Date.now() - startedAt,
        });
      });
    });
  }
}

function pickScript(
  skill: Skill,
  requested: string | undefined,
): SkillScript | undefined {
  if (requested) {
    return skill.scripts.find(
      (s) => s.name === requested || path.basename(s.path) === requested,
    );
  }
  if (skill.scripts.length === 1) return skill.scripts[0];
  return undefined;
}

function buildPickErrorMessage(skill: Skill, requested?: string): string {
  if (skill.scripts.length === 0) {
    return `Skill "${skill.name}" has no scripts to run.`;
  }
  if (!requested) {
    const names = skill.scripts.map((s) => s.name).join(', ');
    return `Skill "${skill.name}" has multiple scripts (${names}); pass one explicitly.`;
  }
  const names = skill.scripts.map((s) => s.name).join(', ');
  return `Skill "${skill.name}" has no script named "${requested}". Available: ${names}.`;
}

function resolveInterpreter(script: SkillScript): {
  command: string;
  prefixArgs: string[];
} {
  return interpreterFor(script.language);
}

export function interpreterFor(language: ScriptLanguage): {
  command: string;
  prefixArgs: string[];
} {
  switch (language) {
    case 'node':
      return { command: process.execPath, prefixArgs: [] };
    case 'python':
      return {
        command: process.platform === 'win32' ? 'python' : 'python3',
        prefixArgs: [],
      };
    case 'bash':
      return { command: 'bash', prefixArgs: [] };
    case 'unknown':
      return { command: '', prefixArgs: [] };
  }
}
