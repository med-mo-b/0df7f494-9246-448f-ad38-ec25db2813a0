import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { SkillValidator } from '../src/core/SkillValidator.js';
import type { Skill } from '../src/types/Skill.js';

const validator = new SkillValidator();

function buildSkill(overrides: Partial<Skill> = {}): Skill {
  const baseRoot = path.resolve('/tmp/skills/example-skill');
  return {
    name: 'example-skill',
    description: 'A skill for tests.',
    rootPath: baseRoot,
    scope: 'user',
    frontmatter: {
      name: 'example-skill',
      description: 'A skill for tests.',
    },
    body: 'instructions',
    scripts: [],
    references: [],
    assets: [],
    ...overrides,
  };
}

describe('SkillValidator', () => {
  it('accepts a valid skill', () => {
    const result = validator.validate(buildSkill());
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects uppercase letters in the name', () => {
    const result = validator.validate(
      buildSkill({
        name: 'BadName',
        rootPath: path.resolve('/tmp/skills/BadName'),
        frontmatter: {
          name: 'BadName',
          description: 'desc',
        },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'frontmatter-invalid')).toBe(
      true,
    );
  });

  it('rejects names with consecutive hyphens', () => {
    const result = validator.validate(
      buildSkill({
        name: 'foo--bar',
        rootPath: path.resolve('/tmp/skills/foo--bar'),
        frontmatter: { name: 'foo--bar', description: 'desc' },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects names that start or end with a hyphen', () => {
    expect(
      validator.validate(
        buildSkill({
          name: '-leading',
          rootPath: path.resolve('/tmp/skills/-leading'),
          frontmatter: { name: '-leading', description: 'desc' },
        }),
      ).ok,
    ).toBe(false);
    expect(
      validator.validate(
        buildSkill({
          name: 'trailing-',
          rootPath: path.resolve('/tmp/skills/trailing-'),
          frontmatter: { name: 'trailing-', description: 'desc' },
        }),
      ).ok,
    ).toBe(false);
  });

  it('rejects empty body', () => {
    const result = validator.validate(buildSkill({ body: '   \n   ' }));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'empty-body')).toBe(true);
  });

  it('rejects when parent directory name does not match frontmatter.name', () => {
    const result = validator.validate(
      buildSkill({
        rootPath: path.resolve('/tmp/skills/different-folder'),
      }),
    );
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((i) => i.code === 'name-dir-mismatch'),
    ).toBe(true);
  });

  it('rejects descriptions over 1024 characters', () => {
    const long = 'x'.repeat(1025);
    const result = validator.validate(
      buildSkill({
        description: long,
        frontmatter: { name: 'example-skill', description: long },
      }),
    );
    expect(result.ok).toBe(false);
  });
});
