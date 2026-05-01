import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  InstallError,
  type InstallSource,
  type Skill,
  type SkillLocation,
  type SkillScope,
} from '../types/Skill.js';
import {
  copyDir,
  ensureDir,
  isDirectory,
  isFile,
  pathExists,
  removeDir,
} from '../utils/filesystem.js';
import { defaultGitClone, type GitClone } from '../utils/git.js';
import { resolveLocation as defaultResolveLocation } from './locations.js';
import { SkillLoader } from './SkillLoader.js';
import { SkillValidator } from './SkillValidator.js';

export type LocationResolver = (
  scope: Exclude<SkillScope, 'system'>,
) => SkillLocation;

export interface InstallOptions {
  /** Overwrite an existing skill at the destination. Default: false. */
  force?: boolean;
}

export interface InstallerDeps {
  loader?: SkillLoader;
  validator?: SkillValidator;
  gitClone?: GitClone;
  /** Override the temp directory factory (mostly for tests). */
  tmpDirFactory?: () => Promise<string>;
  /** Override how install scopes are resolved to filesystem locations. */
  locationResolver?: LocationResolver;
}

/**
 * Installs and uninstalls skills.
 *
 * Two transports: `local` (copy a directory) and `git` (shallow clone +
 * optional subdir copy). All failures are mapped to typed `InstallError`s
 * so the CLI can produce a single human-readable line instead of a stack.
 */
export class SkillInstaller {
  private readonly loader: SkillLoader;
  private readonly validator: SkillValidator;
  private readonly gitClone: GitClone;
  private readonly tmpDirFactory: () => Promise<string>;
  private readonly locationResolver: LocationResolver;

  constructor(deps: InstallerDeps = {}) {
    this.loader = deps.loader ?? new SkillLoader();
    this.validator = deps.validator ?? new SkillValidator();
    this.gitClone = deps.gitClone ?? defaultGitClone;
    this.tmpDirFactory =
      deps.tmpDirFactory ??
      (() => fs.mkdtemp(path.join(os.tmpdir(), 'skill-cli-')));
    this.locationResolver = deps.locationResolver ?? defaultResolveLocation;
  }

  async install(
    source: InstallSource,
    scope: Exclude<SkillScope, 'system'>,
    options: InstallOptions = {},
  ): Promise<Skill> {
    const stagingDir = await this.stage(source);
    try {
      const skillSourceDir = source.subdir
        ? path.join(stagingDir, source.subdir)
        : stagingDir;

      if (!(await isDirectory(skillSourceDir))) {
        throw new InstallError(
          'subdir-not-found',
          `subdirectory not found in source: ${source.subdir ?? '(root)'}`,
        );
      }

      const skillFile = path.join(skillSourceDir, 'SKILL.md');
      if (!(await isFile(skillFile))) {
        throw new InstallError(
          'skill-malformed',
          `source does not contain a SKILL.md file at ${skillSourceDir}`,
        );
      }

      // Strict pre-flight: load and validate before touching the destination.
      let stagedSkill: Skill;
      try {
        stagedSkill = await this.loader.load(skillSourceDir, scope);
      } catch (err) {
        throw new InstallError(
          'skill-malformed',
          `failed to parse skill: ${(err as Error).message}`,
          err,
        );
      }

      // Spec rule: parent dir name must equal frontmatter.name. We rename
      // the destination to frontmatter.name so the rule is satisfied even
      // when the source dir was named differently (e.g. cloned repo root).
      const targetLocation: SkillLocation = this.locationResolver(scope);
      const destination = path.join(targetLocation.rootPath, stagedSkill.name);

      if (await pathExists(destination)) {
        if (!options.force) {
          throw new InstallError(
            'destination-conflict',
            `skill "${stagedSkill.name}" already installed at ${destination} (use --force to overwrite)`,
          );
        }
        await removeDir(destination);
      }

      await ensureDir(targetLocation.rootPath);
      try {
        await copyDir(skillSourceDir, destination);
      } catch (err) {
        throw new InstallError(
          'io-error',
          `failed to copy skill into ${destination}: ${(err as Error).message}`,
          err,
        );
      }

      // Re-load from the final destination so callers get accurate paths.
      const installed = await this.loader.load(destination, scope);
      const validation = this.validator.validate(installed);
      if (!validation.ok) {
        // Roll back -- we don't ship invalid skills.
        await removeDir(destination);
        throw new InstallError(
          'skill-malformed',
          `installed skill failed validation: ${validation.issues
            .map((i) => i.message)
            .join('; ')}`,
        );
      }
      return installed;
    } finally {
      // Best-effort cleanup of the staging dir.
      await removeDir(stagingDir).catch(() => undefined);
    }
  }

  async uninstall(
    name: string,
    scope: Exclude<SkillScope, 'system'>,
  ): Promise<boolean> {
    const location = this.locationResolver(scope);
    const destination = path.join(location.rootPath, name);
    if (!(await pathExists(destination))) return false;
    await removeDir(destination);
    return true;
  }

  /**
   * Materialize the source into a freshly-created temporary directory.
   * Returns the staging dir; the caller is responsible for cleanup
   * (handled in the `install` `finally` block).
   */
  private async stage(source: InstallSource): Promise<string> {
    if (source.kind === 'local') {
      const abs = path.resolve(source.value);
      if (!(await isDirectory(abs))) {
        throw new InstallError(
          'source-not-found',
          `local source is not a directory: ${abs}`,
        );
      }
      const tmp = await this.tmpDirFactory();
      try {
        await copyDir(abs, tmp);
      } catch (err) {
        throw new InstallError(
          'io-error',
          `failed to copy local source into staging dir: ${(err as Error).message}`,
          err,
        );
      }
      return tmp;
    }

    if (source.kind === 'git') {
      if (!source.value.trim()) {
        throw new InstallError('source-invalid', 'git URL is empty');
      }
      const tmp = await this.tmpDirFactory();
      // git clone refuses to write into a non-empty dir; create a sibling.
      const cloneTarget = path.join(tmp, 'repo');
      const cloneArgs: Parameters<GitClone>[0] = {
        url: source.value,
        destination: cloneTarget,
      };
      if (source.ref) cloneArgs.ref = source.ref;
      const result = await this.gitClone(cloneArgs);
      if (!result.ok) {
        // Clean up the empty staging dir before throwing.
        await removeDir(tmp).catch(() => undefined);
        throw new InstallError(
          'git-failed',
          `git clone exited ${result.exitCode}${
            result.stderr ? ` (${truncate(result.stderr, 200)})` : ''
          }`,
        );
      }
      return cloneTarget;
    }

    throw new InstallError(
      'source-invalid',
      `unsupported install source kind: ${(source as InstallSource).kind}`,
    );
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 3)}...`;
}
