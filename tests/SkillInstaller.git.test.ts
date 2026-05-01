import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SkillInstaller } from '../src/core/SkillInstaller.js';
import type { GitClone } from '../src/utils/git.js';
import { isFile } from '../src/utils/fs.js';
import { InstallError, type SkillLocation } from '../src/types/Skill.js';
import { cleanup, makeTempDir } from './helpers.js';

describe('SkillInstaller (git, stubbed)', () => {
  let tmp: string;
  let userRoot: string;

  beforeEach(async () => {
    tmp = await makeTempDir();
    userRoot = path.join(tmp, '.agents', 'skills');
  });

  afterEach(async () => {
    await cleanup(tmp);
  });

  function makeInstaller(gitClone: GitClone): SkillInstaller {
    return new SkillInstaller({
      gitClone,
      locationResolver: (scope): SkillLocation => ({
        scope,
        rootPath: userRoot,
      }),
    });
  }

  it('success path: stub clones a skill into staging, installer copies it', async () => {
    const fakeClone: GitClone = async ({ destination }) => {
      await mkdir(path.join(destination, 'my-skill'), { recursive: true });
      await writeFile(
        path.join(destination, 'my-skill', 'SKILL.md'),
        `---\nname: my-skill\ndescription: Cloned via stub.\n---\nbody\n`,
      );
      return { ok: true, exitCode: 0, stderr: '' };
    };

    const installer = makeInstaller(fakeClone);
    const skill = await installer.install(
      {
        kind: 'git',
        value: 'https://example.invalid/repo.git',
        subdir: 'my-skill',
      },
      'user',
    );
    expect(skill.name).toBe('my-skill');
    expect(
      await isFile(path.join(userRoot, 'my-skill', 'SKILL.md')),
    ).toBe(true);
  });

  it('git failure surfaces as InstallError(code=git-failed) -- no thrown stack trace', async () => {
    const fakeClone: GitClone = async () => ({
      ok: false,
      exitCode: 128,
      stderr: 'fatal: repository not found',
    });
    const installer = makeInstaller(fakeClone);

    await expect(
      installer.install(
        { kind: 'git', value: 'https://example.invalid/missing.git' },
        'user',
      ),
    ).rejects.toMatchObject({
      name: 'InstallError',
      code: 'git-failed',
    });

    try {
      await installer.install(
        { kind: 'git', value: 'https://example.invalid/missing.git' },
        'user',
      );
      throw new Error('expected install to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(InstallError);
      expect((err as InstallError).message).toMatch(/git clone exited 128/);
      expect((err as InstallError).message).toMatch(/repository not found/);
    }
  });

  it('rejects an empty git URL up-front', async () => {
    const installer = makeInstaller(async () => ({
      ok: true,
      exitCode: 0,
      stderr: '',
    }));
    await expect(
      installer.install({ kind: 'git', value: '' }, 'user'),
    ).rejects.toMatchObject({ name: 'InstallError', code: 'source-invalid' });
  });

  it('reports subdir-not-found when the requested subdir is missing', async () => {
    const fakeClone: GitClone = async ({ destination }) => {
      await mkdir(destination, { recursive: true });
      return { ok: true, exitCode: 0, stderr: '' };
    };
    const installer = makeInstaller(fakeClone);
    await expect(
      installer.install(
        {
          kind: 'git',
          value: 'https://example.invalid/repo.git',
          subdir: 'does-not-exist',
        },
        'user',
      ),
    ).rejects.toMatchObject({
      name: 'InstallError',
      code: 'subdir-not-found',
    });
  });
});
