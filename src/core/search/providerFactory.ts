import { LexicalSearchProvider } from './LexicalSearchProvider.js';
import type { SearchProvider } from './SearchProvider.js';

export type ProviderName = 'lexical';

/**
 * Single point of registration for search backends.
 *
 * To add an `EmbeddingsSearchProvider`:
 *   1. Implement `SearchProvider` in this directory.
 *   2. Add a case to the switch below.
 *   3. Add its name to `ProviderName`.
 * No callers (CLI, skill, tests outside this dir) need to change.
 */
export function createSearchProvider(name: ProviderName = 'lexical'): SearchProvider {
  switch (name) {
    case 'lexical':
      return new LexicalSearchProvider();
  }
}

export const AVAILABLE_PROVIDERS: readonly ProviderName[] = ['lexical'];
