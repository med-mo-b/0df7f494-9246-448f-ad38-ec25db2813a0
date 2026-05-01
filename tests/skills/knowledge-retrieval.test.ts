import { spawn } from 'node:child_process';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SkillInstaller } from '../../src/core/SkillInstaller.js';
import { SkillManager } from '../../src/core/SkillManager.js';
import type { SkillLocation } from '../../src/types/Skill.js';
import {
  BUNDLED_SKILLS_DIR,
  cleanup,
  FIXTURES_DIR,
  REPO_ROOT,
  makeTempDir,
} from '../helpers.js';

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runCli(args: string[], cwd: string): Promise<CliResult> {
  return new Promise((resolve) => {
    // Use the local tsx binary so the CLI runs from source without a build.
    const tsxBin =
      process.platform === 'win32'
        ? path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx.cmd')
        : path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

    const child = spawn(
      tsxBin,
      [path.join(REPO_ROOT, 'src', 'cli.ts'), ...args],
      {
        cwd,
        env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
        shell: process.platform === 'win32',
      },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c: Buffer) => {
      stdout += c.toString('utf8');
    });
    child.stderr.on('data', (c: Buffer) => {
      stderr += c.toString('utf8');
    });
    child.on('close', (code) => {
      resolve({ exitCode: code ?? -1, stdout, stderr });
    });
  });
}

describe('knowledge-retrieval skill (end-to-end)', () => {
  let tmp: string;
  let userRoot: string;

  beforeEach(async () => {
    tmp = await makeTempDir();
    userRoot = path.join(tmp, '.agents', 'skills');
  });

  afterEach(async () => {
    await cleanup(tmp);
  });

  it('installs the bundled skill and exposes it via discover()', async () => {
    const installer = new SkillInstaller({
      locationResolver: (scope): SkillLocation => ({
        scope,
        rootPath: userRoot,
      }),
    });
    await installer.install(
      {
        kind: 'local',
        value: path.join(BUNDLED_SKILLS_DIR, 'knowledge-retrieval'),
      },
      'user',
    );

    const manager = new SkillManager({
      locations: [{ scope: 'user', rootPath: userRoot }],
    });
    const found = await manager.get('knowledge-retrieval');
    expect(found).not.toBeNull();
    expect(found?.description).toMatch(/Search local files/);
  });

  it('`skill search --json` returns a SearchHit[] with the expected top file', async () => {
    const docs = path.join(FIXTURES_DIR, 'docs');
    const result = await runCli(
      [
        'search',
        '--query',
        'retries',
        '--path',
        docs,
        '--ext',
        'md',
        '--limit',
        '5',
        '--json',
      ],
      REPO_ROOT,
    );

    expect(result.exitCode, result.stderr).toBe(0);
    const hits = JSON.parse(result.stdout) as Array<{
      file: string;
      line: number;
      snippet: string;
      score: number;
    }>;
    expect(Array.isArray(hits)).toBe(true);
    expect(hits.length).toBeGreaterThan(0);
    expect(path.basename(hits[0]!.file)).toBe('retries.md');
    for (const hit of hits) {
      expect(hit).toHaveProperty('file');
      expect(hit).toHaveProperty('line');
      expect(hit).toHaveProperty('snippet');
      expect(hit).toHaveProperty('score');
    }
  }, 30_000);
});
