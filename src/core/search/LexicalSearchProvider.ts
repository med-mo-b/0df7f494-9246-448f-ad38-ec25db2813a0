import path from 'node:path';

import { safeReadText, walkFiles } from '../../utils/filesystem.js';
import type {
  SearchHit,
  SearchProvider,
  SearchQuery,
} from './SearchProvider.js';

const DEFAULT_EXTENSIONS = [
  'md',
  'mdx',
  'txt',
  'rst',
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'json',
  'yaml',
  'yml',
  'py',
  'go',
  'rs',
  'java',
];

const DEFAULT_LIMIT = 10;
const MAX_SNIPPET_LEN = 240;

/**
 * Pure lexical search:
 *   - tokenize the query on whitespace
 *   - for each line in each file, score by `tokenHits + (3 if exact phrase)`
 *   - return the top N hits
 *
 * No embeddings, no index, no external services. Sufficient for
 * repo-sized corpora and a useful baseline for the SearchProvider seam.
 */
export class LexicalSearchProvider implements SearchProvider {
  readonly name = 'lexical';

  async search(query: SearchQuery): Promise<SearchHit[]> {
    const queryText = query.query.trim();
    if (!queryText) return [];

    const tokens = tokenize(queryText);
    if (tokens.length === 0) return [];
    const phrase = queryText.toLowerCase();

    const roots = (query.paths && query.paths.length > 0
      ? query.paths
      : [process.cwd()]
    ).map((p) => path.resolve(p));

    const extensions = new Set(
      (query.extensions && query.extensions.length > 0
        ? query.extensions
        : DEFAULT_EXTENSIONS
      ).map((e) => e.toLowerCase().replace(/^\./, '')),
    );

    const limit = query.limit && query.limit > 0 ? query.limit : DEFAULT_LIMIT;

    const hits: SearchHit[] = [];
    for (const root of roots) {
      for await (const file of walkFiles(root, { extensions })) {
        const content = await safeReadText(file);
        if (!content) continue;
        scoreFile(file, content, tokens, phrase, hits);
      }
    }

    hits.sort(
      (a, b) =>
        b.score - a.score ||
        a.file.localeCompare(b.file) ||
        a.line - b.line,
    );
    return hits.slice(0, limit);
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,.;:!?()[\]{}<>"'`]+/)
    .filter((t) => t.length > 0);
}

function scoreFile(
  file: string,
  content: string,
  tokens: string[],
  phrase: string,
  out: SearchHit[],
): void {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw === undefined) continue;
    const lower = raw.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (lower.includes(token)) score += 1;
    }
    if (score === 0) continue;
    if (tokens.length > 1 && lower.includes(phrase)) score += 3;
    out.push({
      file,
      line: i + 1,
      snippet: trimSnippet(raw),
      score,
    });
  }
}

function trimSnippet(line: string): string {
  const trimmed = line.trim();
  if (trimmed.length <= MAX_SNIPPET_LEN) return trimmed;
  return `${trimmed.slice(0, MAX_SNIPPET_LEN - 3)}...`;
}
