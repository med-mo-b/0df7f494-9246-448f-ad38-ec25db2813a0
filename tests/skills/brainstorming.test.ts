import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SkillInstaller } from '../../src/core/SkillInstaller.js';
import { SkillManager } from '../../src/core/SkillManager.js';
import type { SkillLocation } from '../../src/types/Skill.js';
import { BUNDLED_SKILLS_DIR, cleanup, makeTempDir } from '../helpers.js';

describe('brainstorming skill (install + discover)', () => {
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
      { kind: 'local', value: path.join(BUNDLED_SKILLS_DIR, 'brainstorming') },
      'user',
    );

    const manager = new SkillManager({
      locations: [{ scope: 'user', rootPath: userRoot }],
    });
    const found = await manager.get('brainstorming');
    expect(found).not.toBeNull();
    expect(found?.description).toMatch(/Refine a rough idea BEFORE writing code/);
  });
});
