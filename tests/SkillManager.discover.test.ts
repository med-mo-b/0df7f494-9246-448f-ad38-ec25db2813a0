import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SkillManager } from '../src/core/SkillManager.js';
import type { SkillLocation } from '../src/types/Skill.js';
import { cleanup, makeTempDir } from './helpers.js';

const SKILL_A = `---
name: alpha-skill
description: Alpha test skill.
---

Body A.
`;

const SKILL_B = `---
name: beta-skill
description: Beta test skill.
---

Body B.
`;

const SKILL_DUPE = `---
name: alpha-skill
description: Alpha overridden in user scope.
---

User-scoped duplicate.
`;

describe('SkillManager.discover', () => {
  let tmp: string;
  let repoDir: string;
  let userDir: string;

  beforeEach(async () => {
    tmp = await makeTempDir();
    repoDir = path.join(tmp, 'repo', '.agents', 'skills');
    userDir = path.join(tmp, 'user', '.agents', 'skills');

    await mkdir(path.join(repoDir, 'alpha-skill'), { recursive: true });
    await writeFile(
      path.join(repoDir, 'alpha-skill', 'SKILL.md'),
      SKILL_A,
    );

    await mkdir(path.join(repoDir, 'beta-skill'), { recursive: true });
    await writeFile(
      path.join(repoDir, 'beta-skill', 'SKILL.md'),
      SKILL_B,
    );

    // Same name in user scope -- spec says both should appear.
    await mkdir(path.join(userDir, 'alpha-skill'), { recursive: true });
    await writeFile(
      path.join(userDir, 'alpha-skill', 'SKILL.md'),
      SKILL_DUPE,
    );
  });

  afterEach(async () => {
    await cleanup(tmp);
  });

  it('finds skills across multiple locations and tags them with their scope', async () => {
    const locations: SkillLocation[] = [
      { scope: 'repo', rootPath: repoDir },
      { scope: 'user', rootPath: userDir },
    ];
    const manager = new SkillManager({ locations });

    const skills = await manager.discover();
    const names = skills.map((s) => `${s.name}@${s.scope}`).sort();
    expect(names).toEqual([
      'alpha-skill@repo',
      'alpha-skill@user',
      'beta-skill@repo',
    ]);
  });

  it('returns empty list when no locations exist', async () => {
    const manager = new SkillManager({
      locations: [{ scope: 'user', rootPath: path.join(tmp, 'nope') }],
    });
    const skills = await manager.discover();
    expect(skills).toEqual([]);
  });

  it('skips malformed skills without poisoning the catalog', async () => {
    // Add a third skill with broken frontmatter to repoDir.
    await mkdir(path.join(repoDir, 'broken-skill'), { recursive: true });
    await writeFile(
      path.join(repoDir, 'broken-skill', 'SKILL.md'),
      `---\nname: BadName\ndescription: x\n---\nbody\n`,
    );

    const manager = new SkillManager({
      locations: [{ scope: 'repo', rootPath: repoDir }],
    });
    const skills = await manager.discover();
    expect(skills.map((s) => s.name).sort()).toEqual([
      'alpha-skill',
      'beta-skill',
    ]);
  });

  it('getAll returns every match across scopes (conflict surfacing)', async () => {
    const locations: SkillLocation[] = [
      { scope: 'repo', rootPath: repoDir },
      { scope: 'user', rootPath: userDir },
    ];
    const manager = new SkillManager({ locations });

    const all = await manager.getAll('alpha-skill');
    expect(all.map((s) => s.scope).sort()).toEqual(['repo', 'user']);
  });
});
