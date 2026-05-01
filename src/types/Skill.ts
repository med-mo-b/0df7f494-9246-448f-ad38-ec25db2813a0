/**
 * Public types for skill-cli.
 *
 * Mirrors the Agent Skills specification (https://agentskills.io/specification).
 */

export type SkillScope = 'repo' | 'user' | 'admin' | 'system';

export type ScriptLanguage = 'node' | 'python' | 'bash' | 'unknown';

/**
 * The YAML frontmatter found at the top of a SKILL.md file.
 *
 * `allowedTools` is the camelCase mapping of the spec's `allowed-tools`
 * key; consumers of this library only ever see the camelCase form.
 */
export interface SkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string;
}

export interface SkillScript {
  /** File basename without extension. */
  name: string;
  /** Absolute path to the script file. */
  path: string;
  language: ScriptLanguage;
}

/**
 * A loaded, in-memory representation of a skill on disk.
 */
export interface Skill {
  /** Skill name. Mirrors both `frontmatter.name` and the parent dir name. */
  name: string;
  /** Convenience copy of `frontmatter.description`. */
  description: string;
  /** Absolute path to the skill directory (containing SKILL.md). */
  rootPath: string;
  /** Which discovery scope this skill was found in. */
  scope: SkillScope;
  frontmatter: SkillFrontmatter;
  /** Markdown body of SKILL.md, after the frontmatter. */
  body: string;
  scripts: SkillScript[];
  /** Relative paths under `references/`, if any. */
  references: string[];
  /** Relative paths under `assets/`, if any. */
  assets: string[];
}

/**
 * One discovery location -- a directory that contains zero or more skill
 * subdirectories.
 */
export interface SkillLocation {
  scope: SkillScope;
  /** Absolute path to the location root, e.g. `~/.agents/skills`. */
  rootPath: string;
}

/**
 * Where a skill should come from when installing.
 *
 * - `local`: `value` is a filesystem path to a skill directory
 *   (must contain SKILL.md), or to a parent dir if `subdir` is set.
 * - `git`:   `value` is a git URL (https or ssh). `ref` is an optional
 *   branch/tag/sha. `subdir` is an optional path inside the cloned repo
 *   pointing at the actual skill folder.
 */
export interface InstallSource {
  kind: 'local' | 'git';
  value: string;
  ref?: string;
  subdir?: string;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface ValidationIssue {
  /** Stable code, useful for tests/automation. */
  code: string;
  message: string;
  /** Dotted path into the skill structure when relevant, e.g. `frontmatter.name`. */
  path?: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

/**
 * Typed install error. The CLI maps this to a single human-readable
 * line; library consumers can switch on `code` to react programmatically.
 */
export class InstallError extends Error {
  public readonly code:
    | 'source-not-found'
    | 'source-invalid'
    | 'git-failed'
    | 'subdir-not-found'
    | 'skill-malformed'
    | 'destination-conflict'
    | 'io-error';
  public readonly cause?: unknown;

  constructor(
    code: InstallError['code'],
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = 'InstallError';
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
