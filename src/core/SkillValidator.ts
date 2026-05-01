import path from 'node:path';
import { z } from 'zod';

import type {
  Skill,
  SkillFrontmatter,
  ValidationIssue,
  ValidationResult,
} from '../types/Skill.js';

/**
 * Spec rules for the `name` field:
 *   - 1..64 chars, lowercase a-z, 0-9, hyphens
 *   - cannot start or end with a hyphen
 *   - cannot contain consecutive hyphens
 */
const NAME_REGEX = /^(?!-)(?!.*--)[a-z0-9-]{1,64}(?<!-)$/;

/**
 * Zod schema mirrors the agentskills.io frontmatter contract.
 * We accept both `allowed-tools` (spec) and `allowedTools` (camelCase)
 * so that callers can hand us either shape.
 */
export const FrontmatterSchema = z
  .object({
    name: z
      .string()
      .min(1, 'name must not be empty')
      .max(64, 'name must be at most 64 characters')
      .regex(
        NAME_REGEX,
        'name must be lowercase alphanumeric with hyphens, no leading/trailing or consecutive hyphens',
      ),
    description: z
      .string()
      .min(1, 'description must not be empty')
      .max(1024, 'description must be at most 1024 characters'),
    license: z.string().min(1).optional(),
    compatibility: z.string().min(1).max(500).optional(),
    metadata: z.record(z.string(), z.string()).optional(),
    'allowed-tools': z.string().min(1).optional(),
    allowedTools: z.string().min(1).optional(),
  })
  .passthrough();

export type RawFrontmatter = z.infer<typeof FrontmatterSchema>;

/**
 * Normalize a raw frontmatter object (as produced by gray-matter) into the
 * library's canonical `SkillFrontmatter` shape. Throws a `ZodError` on
 * spec violations -- the loader catches this and converts to issues.
 */
export function normalizeFrontmatter(input: unknown): SkillFrontmatter {
  const parsed = FrontmatterSchema.parse(input);
  const result: SkillFrontmatter = {
    name: parsed.name,
    description: parsed.description,
  };
  if (parsed.license) result.license = parsed.license;
  if (parsed.compatibility) result.compatibility = parsed.compatibility;
  if (parsed.metadata) result.metadata = parsed.metadata;
  // Prefer the spec-canonical `allowed-tools`, fall back to camelCase.
  const allowed = parsed['allowed-tools'] ?? parsed.allowedTools;
  if (allowed) result.allowedTools = allowed;
  return result;
}

/**
 * Stateless validator for an in-memory `Skill`. Returns all issues found;
 * never throws. The CLI uses this for `skill validate`; the manager runs
 * a strict version on `install`.
 */
export class SkillValidator {
  validate(skill: Skill): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Frontmatter shape -- re-validated even if loader did so, because
    // the public API may be called directly.
    const fmResult = FrontmatterSchema.safeParse(skill.frontmatter);
    if (!fmResult.success) {
      for (const issue of fmResult.error.issues) {
        issues.push({
          code: 'frontmatter-invalid',
          message: issue.message,
          path: ['frontmatter', ...issue.path.map(String)].join('.'),
        });
      }
    }

    // Spec rule: parent dir name must equal frontmatter.name.
    const dirName = path.basename(skill.rootPath);
    if (dirName !== skill.name) {
      issues.push({
        code: 'name-dir-mismatch',
        message: `frontmatter.name "${skill.name}" must match parent directory name "${dirName}"`,
        path: 'frontmatter.name',
      });
    }

    // Body should not be empty -- the spec calls it instructions.
    if (skill.body.trim().length === 0) {
      issues.push({
        code: 'empty-body',
        message: 'SKILL.md body is empty -- no instructions for the agent',
        path: 'body',
      });
    }

    return { ok: issues.length === 0, issues };
  }
}
