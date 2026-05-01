import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SkillInstaller } from '../src/core/SkillInstaller.js';
import { isFile } from '../src/utils/fs.js';
import { InstallError, type SkillLocation } from '../src/types/Skill.js';
import {
  BUNDLED_SKILLS_DIR,
  cleanup,
  FIXTURES_DIR,
  makeTempDir,
} from './helpers.js';

describe('SkillInstaller (local)', () => {
  let tmp: string;
  let userRoot: string;
  let installer: SkillInstaller;

  beforeEach(async () => {
    tmp = await makeTempDir();
    userRoot = path.join(tmp, '.agents', 'skills');
    installer = new SkillInstaller({
      locationResolver: (scope): SkillLocation => ({
        scope,
        rootPath: userRoot,
      }),
    });
  });

  afterEach(async () => {
    await cleanup(tmp);
  });

  it('copies a local skill into the destination and re-loads it', async () => {
    const skill = await installer.install(
      { kind: 'local', value: path.join(FIXTURES_DIR, 'valid-skill') },
      'user',
    );
    expect(skill.name).toBe('valid-skill');
    expect(skill.scope).toBe('user');
    expect(
      await isFile(path.join(userRoot, 'valid-skill', 'SKILL.md')),
    ).toBe(true);
    expect(skill.scripts.map((s) => s.name)).toEqual(['hello']);
  });

  it('installs the bundled knowledge-retrieval skill end-to-end', async () => {
    const skill = await installer.install(
      {
        kind: 'local',
        value: path.join(BUNDLED_SKILLS_DIR, 'knowledge-retrieval'),
      },
      'user',
    );
    expect(skill.name).toBe('knowledge-retrieval');
    expect(skill.frontmatter.compatibility).toMatch(/skill-cli/);
  });

  it('refuses to overwrite an existing skill without --force', async () => {
    await installer.install(
      { kind: 'local', value: path.join(FIXTURES_DIR, 'valid-skill') },
      'user',
    );

    await expect(
      installer.install(
        { kind: 'local', value: path.join(FIXTURES_DIR, 'valid-skill') },
        'user',
      ),
    ).rejects.toMatchObject({
      name: 'InstallError',
      code: 'destination-conflict',
    });
  });

  it('overwrites with --force', async () => {
    await installer.install(
      { kind: 'local', value: path.join(FIXTURES_DIR, 'valid-skill') },
      'user',
    );
    const second = await installer.install(
      { kind: 'local', value: path.join(FIXTURES_DIR, 'valid-skill') },
      'user',
      { force: true },
    );
    expect(second.name).toBe('valid-skill');
  });

  it('rejects a non-existent local source with a typed error', async () => {
    await expect(
      installer.install(
        { kind: 'local', value: path.join(tmp, 'nope') },
        'user',
      ),
    ).rejects.toBeInstanceOf(InstallError);
  });

  it('rejects a malformed local skill (bad frontmatter) with a typed error', async () => {
    await expect(
      installer.install(
        { kind: 'local', value: path.join(FIXTURES_DIR, 'invalid-name') },
        'user',
      ),
    ).rejects.toMatchObject({ name: 'InstallError', code: 'skill-malformed' });
  });

  it('uninstall removes the skill and reports false on second call', async () => {
    await installer.install(
      { kind: 'local', value: path.join(FIXTURES_DIR, 'valid-skill') },
      'user',
    );
    expect(await installer.uninstall('valid-skill', 'user')).toBe(true);
    expect(await installer.uninstall('valid-skill', 'user')).toBe(false);
  });
});
