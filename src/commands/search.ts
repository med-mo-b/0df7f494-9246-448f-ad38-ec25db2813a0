import pc from 'picocolors';

import {
  AVAILABLE_PROVIDERS,
  createSearchProvider,
  type ProviderName,
} from '../core/search/providerFactory.js';
import type { SearchHit, SearchQuery } from '../core/search/SearchProvider.js';
import { logger } from '../utils/logger.js';

export interface SearchOptions {
  query: string;
  paths?: string[];
  extensions?: string[];
  limit?: number;
  provider?: string;
  json?: boolean;
}

export async function runSearch(options: SearchOptions): Promise<number> {
  const providerName = (options.provider ?? 'lexical') as ProviderName;
  if (!AVAILABLE_PROVIDERS.includes(providerName)) {
    logger.error(
      `unknown search provider: ${options.provider} ` +
        `(available: ${AVAILABLE_PROVIDERS.join(', ')})`,
    );
    return 1;
  }
  const provider = createSearchProvider(providerName);

  const query: SearchQuery = { query: options.query };
  if (options.paths && options.paths.length > 0) query.paths = options.paths;
  if (options.extensions && options.extensions.length > 0) {
    query.extensions = options.extensions;
  }
  if (options.limit) query.limit = options.limit;

  const hits = await provider.search(query);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(hits, null, 2)}\n`);
    return 0;
  }

  if (hits.length === 0) {
    process.stdout.write('No matches.\n');
    return 0;
  }
  for (const hit of hits) {
    printHit(hit);
  }
  return 0;
}

function printHit(hit: SearchHit): void {
  process.stdout.write(
    `${pc.cyan(`${hit.file}:${hit.line}`)} ` +
      `${pc.dim(`(score ${hit.score})`)}\n  ${hit.snippet}\n`,
  );
}
