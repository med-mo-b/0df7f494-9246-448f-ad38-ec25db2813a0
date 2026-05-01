/**
 * Public library surface for skill-cli.
 *
 * Consumers can build on `SkillManager` directly without going through
 * the CLI, and may swap in custom implementations of `SearchProvider`
 * or any of the manager's collaborators.
 */

export { SkillManager, type SkillManagerOptions } from './core/SkillManager.js';
export { SkillLoader } from './core/SkillLoader.js';
export {
  SkillValidator,
  FrontmatterSchema,
  normalizeFrontmatter,
} from './core/SkillValidator.js';
export {
  SkillInstaller,
  type InstallOptions,
  type InstallerDeps,
  type LocationResolver,
} from './core/SkillInstaller.js';
export {
  SkillExecutor,
  type ExecOptions,
  interpreterFor,
} from './core/SkillExecutor.js';

export {
  defaultLocations,
  resolveLocation,
  filterExistingLocations,
  userLocationPath,
  adminLocationPath,
  repoLocationPaths,
  SKILLS_SUBPATH,
} from './core/locations.js';

export type {
  SearchHit,
  SearchProvider,
  SearchQuery,
} from './core/search/SearchProvider.js';
export { LexicalSearchProvider } from './core/search/LexicalSearchProvider.js';
export {
  createSearchProvider,
  AVAILABLE_PROVIDERS,
  type ProviderName,
} from './core/search/providerFactory.js';

export {
  InstallError,
  type ExecResult,
  type InstallSource,
  type ScriptLanguage,
  type Skill,
  type SkillFrontmatter,
  type SkillLocation,
  type SkillScope,
  type SkillScript,
  type ValidationIssue,
  type ValidationResult,
} from './types/Skill.js';
