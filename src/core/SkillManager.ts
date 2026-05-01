import { promises as fs } from 'node:fs';
import path from 'node:path';

import type {
  ExecResult,
  InstallSource,
  Skill,
  SkillLocation,
  SkillScope,
  ValidationResult,
} from '../types/Skill.js';
import { isDirectory } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import { defaultLocations } from './locations.js';
import { SkillExecutor, type ExecOptions } from './SkillExecutor.js';
import { SkillInstaller, type InstallOptions } from './SkillInstaller.js';
import { SkillLoader } from './SkillLoader.js';
import { SkillValidator } from './SkillValidator.js';

export interface SkillManagerOptions {
  /** Discovery locations in priority order. Defaults to repo + user + admin. */
  locations?: SkillLocation[];
  loader?: SkillLoader;
  validator?: SkillValidator;
  installer?: SkillInstaller;
  executor?: SkillExecutor;
}

/**
 * High-level orchestration for the skill lifecycle.
 *
 * The manager is intentionally thin -- discovery is uncached and runs the
 * loader once per call. This keeps behavior predictable and easy to test;
 * caching can be layered on top in v2 without changing the API.
 */
export class SkillManager {
  private readonly locations: SkillLocation[];
  private readonly loader: SkillLoader;
  private readonly validator: SkillValidator;
  private readonly installer: SkillInstaller;
  private readonly executor: SkillExecutor;

  constructor(options: SkillManagerOptions = {}) {
    this.locations = options.locations ?? defaultLocations();
    this.loader = options.loader ?? new SkillLoader();
    this.validator = options.validator ?? new SkillValidator();
    this.installer = options.installer ?? new SkillInstaller();
    this.executor = options.executor ?? new SkillExecutor();
  }

  /**
   * Walk every configured location and load every skill found. Skills that
   * fail to load (missing/malformed SKILL.md) are logged at debug level and
   * skipped -- they do not poison the catalog.
   */
  async discover(): Promise<Skill[]> {
    const skills: Skill[] = [];
    for (const location of this.locations) {
      if (!(await isDirectory(location.rootPath))) continue;
      let entries;
      try {
        entries = await fs.readdir(location.rootPath, { withFileTypes: true });
      } catch (err) {
        logger.debug(
          `failed to read location ${location.rootPath}: ${(err as Error).message}`,
        );
        continue;
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillRoot = path.join(location.rootPath, entry.name);
        try {
          const skill = await this.loader.load(skillRoot, location.scope);
          skills.push(skill);
        } catch (err) {
          logger.debug(
            `skipping ${skillRoot}: ${(err as Error).message}`,
          );
        }
      }
    }
    return skills;
  }

  /**
   * Find a skill by name. If `scope` is provided, only that scope is
   * searched. Otherwise the first match in discovery order wins.
   */
  async get(name: string, scope?: SkillScope): Promise<Skill | null> {
    const all = await this.discover();
    for (const skill of all) {
      if (skill.name !== name) continue;
      if (scope && skill.scope !== scope) continue;
      return skill;
    }
    return null;
  }

  /**
   * Return *every* skill matching `name` across all discovery scopes.
   * Conflicts are surfaced, not silently merged.
   */
  async getAll(name: string): Promise<Skill[]> {
    const all = await this.discover();
    return all.filter((s) => s.name === name);
  }

  async install(
    source: InstallSource,
    scope: Exclude<SkillScope, 'system'>,
    options?: InstallOptions,
  ): Promise<Skill> {
    return await this.installer.install(source, scope, options);
  }

  async uninstall(
    name: string,
    scope: Exclude<SkillScope, 'system'>,
  ): Promise<boolean> {
    return await this.installer.uninstall(name, scope);
  }

  async run(
    name: string,
    script?: string,
    args: string[] = [],
    options?: ExecOptions,
  ): Promise<ExecResult> {
    const skill = await this.get(name);
    if (!skill) throw new Error(`skill not found: ${name}`);
    return await this.executor.run(skill, script, args, options);
  }

  /**
   * Validate a skill on disk against the spec. Pass either a path to a
   * skill directory or a path to a SKILL.md file.
   */
  async validate(rootPath: string): Promise<ValidationResult> {
    const root = (await isDirectory(rootPath))
      ? rootPath
      : path.dirname(rootPath);
    try {
      const skill = await this.loader.load(root, 'user');
      return this.validator.validate(skill);
    } catch (err) {
      return {
        ok: false,
        issues: [
          {
            code: 'load-failed',
            message: (err as Error).message,
          },
        ],
      };
    }
  }

  /** Expose the configured locations (read-only) for diagnostics. */
  getLocations(): readonly SkillLocation[] {
    return this.locations;
  }
}
