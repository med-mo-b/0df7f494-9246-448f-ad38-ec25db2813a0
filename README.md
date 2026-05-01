# skill-cli

A TypeScript CLI and library for discovering, installing, validating, and
running [Agent Skills](https://agentskills.io/specification) locally.

Ships with two reference skills:

- **`knowledge-retrieval`** — lexical search over local files, behind a
  pluggable `SearchProvider` interface (embeddings backend is a one-file
  swap-in).
- **`brainstorming`** — walks the agent through clarifying questions,
  architectural alternatives, validated design sections, and writes a
  `DESIGN-*.md` document. Activates *before* writing code.

Skills are plain folders that follow the
[agentskills.io spec](https://agentskills.io/specification) and are dropped
into conventional locations (`.agents/skills` in repo or `$HOME`) that
compatible agents scan on launch.

---

## Requirements

- Node.js ≥ 18.17
- `git` on `PATH` (only needed for installing skills from git URLs)

## Install

```bash
npm install
npm run build
npm link            # makes `skill` available globally; optional
```

If you skip `npm link`, substitute `skill` with `node dist/cli.js` in the
examples below.

## Quick start

```bash
# install both bundled skills into the user scope (~/.agents/skills)
skill install ./skills/knowledge-retrieval
skill install ./skills/brainstorming

# list what's installed
skill list

# print a skill's SKILL.md to stdout
skill show knowledge-retrieval

# search local files (this is what the knowledge-retrieval skill invokes)
skill search --query "retry policy" --path ./docs --ext md --json

# validate a skill folder against the spec
skill validate ./skills/brainstorming

# uninstall
skill uninstall knowledge-retrieval
```

## CLI reference

| Command | Purpose |
| --- | --- |
| `skill list [--scope repo\|user\|admin\|all] [--json]` | Discover and print installed skills. |
| `skill show <name>` | Print a skill's `SKILL.md` to stdout. |
| `skill install <source> [--scope user\|repo\|admin] [--ref <git-ref>] [--subdir <path>] [--force]` | Install from a local path or a git URL. |
| `skill uninstall <name> [--scope user\|repo\|admin]` | Remove an installed skill. |
| `skill run <name> [script] [-- ...args]` | Execute a script inside a skill. |
| `skill search --query <q> [--path <dir>...] [--ext <csv>] [--limit <n>] [--provider lexical] [--json]` | Run the configured `SearchProvider`. |
| `skill validate <path> [--json]` | Validate a skill folder against the agentskills.io spec. |

`<source>` is treated as a git URL when it starts with `https://`, `ssh://`,
`git@`, or ends with `.git`; otherwise it is treated as a local path.

## Installation scopes

Skills are discovered from three locations, in priority order:

| Scope | Path |
| --- | --- |
| `repo`  | `<cwd-or-ancestor>/.agents/skills` |
| `user`  | `$HOME/.agents/skills` |
| `admin` | `/etc/<subdir>/skills` (POSIX) or `%PROGRAMDATA%\<subdir>\skills` (Windows) |

`skill install` defaults to `--scope user`, writing to
`$HOME/.agents/skills/<name>`. For a repo-local skill (e.g. tied to one
service), use `--scope repo`, which writes to `./.agents/skills/<name>`.
There is no separate registration step — the skill folder *is* the
registration.

## Authoring a skill

```text
my-skill/
├── SKILL.md          # required: YAML frontmatter + markdown body
├── scripts/          # optional: executables invokable via `skill run`
├── references/       # optional: long-form docs loaded on demand
└── assets/           # optional: templates, schemas, images
```

Minimum `SKILL.md`:

```md
---
name: my-skill
description: One sentence on what it does AND when to use it. Include trigger words.
---

Step-by-step instructions for the agent...
```

Validate as you go:

```bash
skill validate ./my-skill
```

The validator enforces every rule in the
[agentskills.io spec](https://agentskills.io/specification): name format,
length caps, parent-directory-name match, non-empty body, etc.

## Library use

The CLI is a thin layer over a reusable library:

```ts
import { SkillManager, LexicalSearchProvider } from 'skill-cli';

const manager = new SkillManager();
const skills = await manager.discover();

// Run a skill's primary script and capture its output:
const result = await manager.run('knowledge-retrieval', undefined, [
  '--query', 'retry policy',
]);
console.log(result.stdout);

// Or use the search backend directly:
const hits = await new LexicalSearchProvider().search({
  query: 'cache TTL',
  paths: ['./docs'],
});
```

All collaborators (`SkillLoader`, `SkillValidator`, `SkillExecutor`,
`SkillInstaller`) are constructor-injected, so substituting any of them for
a test or alternate environment is trivial.

## Extending the search backend

`SearchProvider` is the single architectural seam for the
`knowledge-retrieval` skill:

```ts
export interface SearchProvider {
  readonly name: string;
  search(query: SearchQuery): Promise<SearchHit[]>;
}
```

`LexicalSearchProvider` ships as the default (zero deps, no API key, no
index — fast file walk + score). To add a vector backend:

1. Implement `EmbeddingsSearchProvider` in `src/core/search/`.
2. Add a case in `src/core/search/providerFactory.ts` and an entry in
   `ProviderName`.
3. Done. The skill, the CLI, and every other consumer are unchanged. Use
   it via `skill search --provider embeddings`.

## Testing

```bash
npm test
```

Runs the full vitest suite: loader, validator, manager discovery,
installer (local + git-stubbed), executor, search provider, and an
end-to-end test that exercises the CLI against the bundled
`knowledge-retrieval` skill.

## Project layout

```
skill-cli/
├── src/
│   ├── cli.ts                  # commander entrypoint
│   ├── index.ts                # library exports
│   ├── commands/               # one file per CLI verb
│   ├── core/
│   │   ├── SkillManager.ts     # orchestration
│   │   ├── SkillLoader.ts
│   │   ├── SkillValidator.ts
│   │   ├── SkillExecutor.ts
│   │   ├── SkillInstaller.ts
│   │   ├── locations.ts
│   │   └── search/
│   │       ├── SearchProvider.ts
│   │       ├── LexicalSearchProvider.ts
│   │       └── providerFactory.ts
│   ├── types/Skill.ts
│   └── utils/                  # fs, git, logger
├── skills/
│   ├── knowledge-retrieval/
│   └── brainstorming/
└── tests/                      # vitest suites + fixtures
```

## License

MIT
