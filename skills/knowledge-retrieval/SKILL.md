---
name: knowledge-retrieval
description: Search local files for context by keyword. Use when the user asks to find documentation, look up references in the repo, pull context from local notes, READMEs, or source files, or grep-style locate where something is mentioned. Lexical search by default; pluggable backend via the `SearchProvider` interface in skill-cli.
compatibility: Requires `skill-cli` on PATH (provides `skill search`).
license: MIT
---

# Knowledge Retrieval

Use this skill any time the user asks to **find, locate, or summarize**
information that already exists in local files (docs, READMEs, notes,
source code).

## How to use

1. Pick a focused search query and, optionally, one or more root
   directories. If the user did not specify a root, use the current
   working directory.
2. Run:

   ```bash
   skill search --query "<keywords>" \
     [--path <dir> ...] \
     [--ext md,txt,mdx,ts,py] \
     [--limit 10] \
     --json
   ```

3. The CLI prints JSON: a ranked array of objects with shape
   `{ file, line, snippet, score }`.
4. Summarize the top hits for the user as `path:line` followed by the
   snippet. Group by file when several hits share one file.
5. If the result is empty, broaden the query (drop modifiers, try a
   synonym) and retry **once**. If still empty, tell the user the
   search returned no matches and suggest they widen scope.

## When NOT to use

- The user wants you to *write* something new (use the writing tools).
- The user is asking about external/web information (use a web tool).
- The information is in a single open file the user has already shared.

## Notes for advanced use

- The default extension list covers Markdown, plain text, and common
  source files. Override with `--ext` when the user explicitly wants
  to scope (e.g. `--ext md` for docs only).
- Multiple `--path` flags are additive; use this when the user
  mentions several roots ("search docs/ and packages/api/src").
- `--provider` selects the backend. Today only `lexical` is shipped;
  the same SKILL.md will work unchanged when an embeddings backend
  is added to skill-cli.
