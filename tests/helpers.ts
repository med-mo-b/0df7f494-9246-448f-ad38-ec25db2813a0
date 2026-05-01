import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const FIXTURES_DIR = path.join(HERE, 'fixtures');
export const REPO_ROOT = path.resolve(HERE, '..');
export const BUNDLED_SKILLS_DIR = path.join(REPO_ROOT, 'skills');

export async function makeTempDir(prefix = 'skill-cli-test-'): Promise<string> {
  return await mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function cleanup(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
