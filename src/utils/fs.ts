import { promises as fs, constants as fsConstants } from 'node:fs';
import path from 'node:path';

const DEFAULT_IGNORE = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  '.cache',
]);

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function isFile(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isFile();
  } catch {
    return false;
  }
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Recursively copy `src` into `dest`. `dest` will be created if missing.
 * Skips entries in `DEFAULT_IGNORE` plus anything in `extraIgnore`.
 */
export async function copyDir(
  src: string,
  dest: string,
  extraIgnore: ReadonlySet<string> = new Set(),
): Promise<void> {
  await ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (DEFAULT_IGNORE.has(entry.name) || extraIgnore.has(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to, extraIgnore);
    } else if (entry.isSymbolicLink()) {
      const target = await fs.readlink(from);
      await fs.symlink(target, to).catch(async () => {
        // Fallback: read+write the resolved file. Symlinks on Windows often
        // need elevated privileges, so we degrade gracefully.
        const data = await fs.readFile(from);
        await fs.writeFile(to, data);
      });
    } else if (entry.isFile()) {
      await fs.copyFile(from, to);
    }
  }
}

export async function removeDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

export interface WalkOptions {
  /** File extensions to include (without dot). If empty, include all files. */
  extensions?: ReadonlySet<string>;
  /** Names to skip (in addition to DEFAULT_IGNORE). */
  ignore?: ReadonlySet<string>;
  /** Maximum file size in bytes to read. Defaults to 2 MiB. */
  maxFileBytes?: number;
}

/**
 * Async generator that yields absolute file paths under `root`.
 * Honors the default ignore list and any extra ignore names.
 */
export async function* walkFiles(
  root: string,
  options: WalkOptions = {},
): AsyncGenerator<string> {
  const { extensions, ignore } = options;
  const ignored = new Set([...DEFAULT_IGNORE, ...(ignore ?? [])]);
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) break;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (ignored.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        if (extensions && extensions.size > 0) {
          const ext = path.extname(entry.name).slice(1).toLowerCase();
          if (!extensions.has(ext)) continue;
        }
        yield full;
      }
    }
  }
}

/** Safe read: returns null on any error (missing file, permission, too large). */
export async function safeReadText(
  filePath: string,
  maxBytes = 2 * 1024 * 1024,
): Promise<string | null> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size > maxBytes) return null;
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}
