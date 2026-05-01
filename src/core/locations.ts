import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { SkillLocation, SkillScope } from '../types/Skill.js';
import { isDirectory } from '../utils/filesystem.js';

/**
 * Conventional sub-path for repo and user scopes, per the Agent Skills spec.
 *
 * See https://agentskills.io/specification.
 */
export const SKILLS_SUBPATH = path.join('.agents', 'skills');

/**
 * Absolute path for the user-scope skills directory: `$HOME/.agents/skills`.
 */
export function userLocationPath(): string {
  return path.join(os.homedir(), SKILLS_SUBPATH);
}

/**
 * Absolute path for the admin-scope skills directory.
 *
 * On POSIX this is `/etc/agent-skills/skills`. On Windows we fall back to
 * `%PROGRAMDATA%/agent-skills/skills`. Consumers should check for
 * existence before use.
 */
export function adminLocationPath(): string {
  if (process.platform === 'win32') {
    const programData = process.env['PROGRAMDATA'] ?? 'C:\\ProgramData';
    return path.join(programData, 'agent-skills', 'skills');
  }
  return path.join('/etc', 'agent-skills', 'skills');
}

/**
 * Walk from `cwd` up to the filesystem root, collecting every
 * `.agents/skills` directory we encounter. The spec defines three repo
 * scopes (cwd, parent, repo root); we collapse them into a single "repo"
 * scope and return distinct paths in nearest-first order.
 *
 * Stopping at a `.git` directory matches the spec's "repo root" notion.
 */
export function repoLocationPaths(cwd: string = process.cwd()): string[] {
  const seen = new Set<string>();
  const paths: string[] = [];
  let current = path.resolve(cwd);
  let foundGit = false;

  while (true) {
    const candidate = path.join(current, SKILLS_SUBPATH);
    if (!seen.has(candidate)) {
      seen.add(candidate);
      paths.push(candidate);
    }

    // Once we have passed the repo root (a directory containing .git)
    // we stop walking upward -- per spec, the topmost root is the
    // boundary for repo-scoped discovery.
    const gitMarker = path.join(current, '.git');
    if (foundGit) break;
    if (existsSync(gitMarker)) foundGit = true;

    const parent = path.dirname(current);
    if (parent === current) break; // filesystem root
    current = parent;
  }

  return paths;
}

/**
 * Compute the default set of discovery locations in priority order:
 * repo (nearest-first), then user, then admin. Locations are returned
 * unfiltered -- callers that only want existing dirs should filter
 * via `filterExistingLocations`.
 */
export function defaultLocations(cwd: string = process.cwd()): SkillLocation[] {
  const out: SkillLocation[] = [];
  for (const rootPath of repoLocationPaths(cwd)) {
    out.push({ scope: 'repo', rootPath });
  }
  out.push({ scope: 'user', rootPath: userLocationPath() });
  out.push({ scope: 'admin', rootPath: adminLocationPath() });
  return out;
}

/** Resolve a single scope's canonical location root. */
export function resolveLocation(
  scope: Exclude<SkillScope, 'system'>,
  cwd: string = process.cwd(),
): SkillLocation {
  switch (scope) {
    case 'repo':
      // Nearest .agents/skills to cwd -- write to cwd itself by default.
      return { scope, rootPath: path.join(path.resolve(cwd), SKILLS_SUBPATH) };
    case 'user':
      return { scope, rootPath: userLocationPath() };
    case 'admin':
      return { scope, rootPath: adminLocationPath() };
  }
}

export async function filterExistingLocations(
  locations: SkillLocation[],
): Promise<SkillLocation[]> {
  const checks = await Promise.all(
    locations.map(async (loc) => ((await isDirectory(loc.rootPath)) ? loc : null)),
  );
  return checks.filter((l): l is SkillLocation => l !== null);
}

