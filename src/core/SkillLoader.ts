import { promises as fs } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

import type {
  ScriptLanguage,
  Skill,
  SkillScope,
  SkillScript,
} from '../types/Skill.js';
import { isDirectory, isFile, pathExists } from '../utils/filesystem.js';
import { normalizeFrontmatter } from './SkillValidator.js';

const SKILL_FILE = 'SKILL.md';

/**
 * Loads a `Skill` from disk. The loader is intentionally strict about the
 * frontmatter (it must match the agentskills.io spec) but tolerant about
 * the body and the optional sub-directories (`scripts/`, `references/`,
 * `assets/`) -- those may be absent.
 */
export class SkillLoader {
  /**
   * Load the skill rooted at `rootPath`. Throws if SKILL.md is missing
   * or its frontmatter fails the spec; the manager catches and reports.
   */
  async load(rootPath: string, scope: SkillScope): Promise<Skill> {
    const absRoot = path.resolve(rootPath);
    const skillFile = path.join(absRoot, SKILL_FILE);

    if (!(await isFile(skillFile))) {
      throw new Error(`SKILL.md not found at ${skillFile}`);
    }

    const raw = await fs.readFile(skillFile, 'utf8');
    const parsed = matter(raw);
    const frontmatter = normalizeFrontmatter(parsed.data);

    const [scripts, references, assets] = await Promise.all([
      this.collectScripts(absRoot),
      this.collectRelativeFiles(absRoot, 'references'),
      this.collectRelativeFiles(absRoot, 'assets'),
    ]);

    return {
      name: frontmatter.name,
      description: frontmatter.description,
      rootPath: absRoot,
      scope,
      frontmatter,
      body: parsed.content.trimStart(),
      scripts,
      references,
      assets,
    };
  }

  private async collectScripts(rootPath: string): Promise<SkillScript[]> {
    const scriptsDir = path.join(rootPath, 'scripts');
    if (!(await isDirectory(scriptsDir))) return [];
    const entries = await fs.readdir(scriptsDir, { withFileTypes: true });
    const result: SkillScript[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const full = path.join(scriptsDir, entry.name);
      const ext = path.extname(entry.name).toLowerCase();
      result.push({
        name: path.basename(entry.name, ext),
        path: full,
        language: detectLanguage(ext),
      });
    }
    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }

  private async collectRelativeFiles(
    rootPath: string,
    subdir: string,
  ): Promise<string[]> {
    const dir = path.join(rootPath, subdir);
    if (!(await pathExists(dir)) || !(await isDirectory(dir))) return [];
    const out: string[] = [];
    await walkInto(dir, dir, out);
    out.sort();
    return out.map((p) => path.join(subdir, p));
  }
}

async function walkInto(
  base: string,
  current: string,
  out: string[],
): Promise<void> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await walkInto(base, full, out);
    } else if (entry.isFile()) {
      out.push(path.relative(base, full));
    }
  }
}

function detectLanguage(ext: string): ScriptLanguage {
  switch (ext) {
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'node';
    case '.py':
      return 'python';
    case '.sh':
    case '.bash':
      return 'bash';
    default:
      return 'unknown';
  }
}
