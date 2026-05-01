/**
 * The SearchProvider interface is the architectural seam for the
 * Knowledge Retrieval skill. The skill, the CLI, and any consumer
 * depend only on these three types -- swapping the implementation
 * (lexical -> embeddings, etc.) does not ripple anywhere else.
 */

export interface SearchQuery {
  query: string;
  /** Roots to search. Defaults to `[process.cwd()]`. */
  paths?: string[];
  /** File extensions (without dot) to include, e.g. `['md', 'txt']`. */
  extensions?: string[];
  /** Maximum hits to return. Defaults to 10. */
  limit?: number;
}

export interface SearchHit {
  /** Absolute path to the matched file. */
  file: string;
  /** 1-indexed line number. */
  line: number;
  /** Single-line excerpt, trimmed. */
  snippet: string;
  /** Higher is more relevant. Provider-defined units. */
  score: number;
}

export interface SearchProvider {
  readonly name: string;
  search(query: SearchQuery): Promise<SearchHit[]>;
}
