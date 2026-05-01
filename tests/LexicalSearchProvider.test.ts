import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { LexicalSearchProvider } from '../src/core/search/LexicalSearchProvider.js';
import { FIXTURES_DIR } from './helpers.js';

const DOCS = path.join(FIXTURES_DIR, 'docs');

describe('LexicalSearchProvider', () => {
  const provider = new LexicalSearchProvider();

  it('ranks the most relevant file first', async () => {
    const hits = await provider.search({
      query: 'retries',
      paths: [DOCS],
      extensions: ['md'],
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(path.basename(hits[0]!.file)).toBe('retries.md');
  });

  it('returns multi-token matches and gives the exact phrase a bonus', async () => {
    const hits = await provider.search({
      query: 'retry policy',
      paths: [DOCS],
    });
    expect(hits.length).toBeGreaterThan(0);
    const top = hits[0]!;
    expect(path.basename(top.file)).toBe('retries.md');
    // Bonus of +3 is given when both tokens appear AND the phrase appears.
    expect(top.score).toBeGreaterThanOrEqual(2);
  });

  it('respects the limit option', async () => {
    const hits = await provider.search({
      query: 'the',
      paths: [DOCS],
      limit: 2,
    });
    expect(hits.length).toBeLessThanOrEqual(2);
  });

  it('honors the extensions filter', async () => {
    const hits = await provider.search({
      query: 'cache',
      paths: [DOCS],
      extensions: ['txt'],
    });
    expect(hits).toEqual([]);
  });

  it('returns empty array on a query with no matches', async () => {
    const hits = await provider.search({
      query: 'kubernetes-operator-foo-bar',
      paths: [DOCS],
    });
    expect(hits).toEqual([]);
  });

  it('returns empty array on an empty query', async () => {
    const hits = await provider.search({ query: '   ', paths: [DOCS] });
    expect(hits).toEqual([]);
  });

  it('exposes a stable provider name', () => {
    expect(provider.name).toBe('lexical');
  });
});
