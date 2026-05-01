import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { SkillExecutor } from '../src/core/SkillExecutor.js';
import { SkillLoader } from '../src/core/SkillLoader.js';
import { FIXTURES_DIR } from './helpers.js';

describe('SkillExecutor', () => {
  const loader = new SkillLoader();
  const executor = new SkillExecutor();

  it('runs the skill\'s only script (no name needed)', async () => {
    const skill = await loader.load(
      path.join(FIXTURES_DIR, 'valid-skill'),
      'user',
    );
    const result = await executor.run(skill, undefined, ['world']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello world');
    expect(result.stderr).toBe('');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('runs a script picked by name', async () => {
    const skill = await loader.load(
      path.join(FIXTURES_DIR, 'valid-skill'),
      'user',
    );
    const result = await executor.run(skill, 'hello', []);
    expect(result.exitCode).toBe(0);
  });

  it('throws when the requested script is missing', async () => {
    const skill = await loader.load(
      path.join(FIXTURES_DIR, 'valid-skill'),
      'user',
    );
    await expect(executor.run(skill, 'nope', [])).rejects.toThrow(
      /no script named/,
    );
  });

  it('throws when the skill has no scripts at all', async () => {
    const skill = await loader.load(
      path.join(FIXTURES_DIR, 'valid-skill'),
      'user',
    );
    const stripped = { ...skill, scripts: [] };
    await expect(executor.run(stripped, undefined, [])).rejects.toThrow(
      /has no scripts/,
    );
  });
});
