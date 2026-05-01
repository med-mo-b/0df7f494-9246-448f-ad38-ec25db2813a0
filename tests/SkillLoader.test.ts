import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { SkillLoader } from '../src/core/SkillLoader.js';
import { FIXTURES_DIR } from './helpers.js';

describe('SkillLoader', () => {
  const loader = new SkillLoader();

  it('parses frontmatter, body, and scripts of a valid skill', async () => {
    const skill = await loader.load(
      path.join(FIXTURES_DIR, 'valid-skill'),
      'user',
    );

    expect(skill.name).toBe('valid-skill');
    expect(skill.description).toMatch(/minimal valid skill/);
    expect(skill.scope).toBe('user');
    expect(skill.body.startsWith('# Valid skill')).toBe(true);

    expect(skill.frontmatter.license).toBe('MIT');
    expect(skill.frontmatter.compatibility).toBe('Designed for agent runtimes.');
    expect(skill.frontmatter.metadata).toEqual({
      author: 'skill-cli-tests',
      version: '1.0',
    });
  });

  it('maps the spec key `allowed-tools` onto camelCase `allowedTools`', async () => {
    const skill = await loader.load(
      path.join(FIXTURES_DIR, 'valid-skill'),
      'user',
    );
    expect(skill.frontmatter.allowedTools).toBe('Bash(git:*) Read');
  });

  it('discovers scripts and infers their language from the file extension', async () => {
    const skill = await loader.load(
      path.join(FIXTURES_DIR, 'valid-skill'),
      'user',
    );
    expect(skill.scripts).toHaveLength(1);
    expect(skill.scripts[0]?.name).toBe('hello');
    expect(skill.scripts[0]?.language).toBe('node');
    expect(skill.scripts[0]?.path.endsWith('hello.mjs')).toBe(true);
  });

  it('throws when SKILL.md is missing', async () => {
    await expect(
      loader.load(path.join(FIXTURES_DIR, 'does-not-exist'), 'user'),
    ).rejects.toThrow(/SKILL\.md not found/);
  });

  it('throws when frontmatter violates the spec (uppercase + underscore name)', async () => {
    await expect(
      loader.load(path.join(FIXTURES_DIR, 'invalid-name'), 'user'),
    ).rejects.toThrow();
  });
});
