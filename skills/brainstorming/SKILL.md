---
name: brainstorming
description: Refine a rough idea BEFORE writing code. Use when the user describes a new feature, system, refactor, or design with ambiguous scope. Walks through clarifying questions, presents 2-3 architectural alternatives, validates each design section with the user, and finally saves a DESIGN-*.md document. Stop and use this skill instead of jumping to implementation.
license: MIT
---

# Brainstorming (pre-implementation design)

**DO NOT WRITE PRODUCTION CODE WHILE THIS SKILL IS ACTIVE.**

Run four phases sequentially. Wait for **explicit user confirmation**
between phases -- do not auto-advance.

---

## Phase 1 -- Clarify

Ask **2 to 5 minimal questions** to disambiguate the request. Cover, in
order of importance:

- **Goal** -- what does success look like in one sentence?
- **Constraints** -- performance, deployment target, team size, budget,
  hard deadlines.
- **Non-goals** -- what is *explicitly* out of scope?
- **Integration points** -- existing systems, APIs, data stores this
  must work with.
- **Success criteria** -- how will the user know it's done?

Stop at 5 questions even if more come to mind. Ask them in **one
message**, numbered, and wait for answers.

---

## Phase 2 -- Explore alternatives

Present **2 or 3 distinct** architectural approaches. Never present
just one. For each option, format as:

```
### Option N: <one-line summary>

Pros
- ...
- ...
- ...

Cons
- ...
- ...
- ...

Complexity: S | M | L
```

Then ask the user to pick one, hybridize, or request a fourth.

---

## Phase 3 -- Design sections (validate one at a time)

For the chosen approach, draft each of the four sections below. After
each section, **stop and ask** for confirmation before moving on.

1. **Components & responsibilities** -- bullet list of modules/services
   and what each owns.
2. **Data model / interfaces** -- the key types, schemas, or API
   contracts.
3. **Key flows** -- 2-4 numbered step-by-step sequences for the most
   important user/system interactions.
4. **Open questions & risks** -- anything still unresolved, with a
   suggested resolution path.

Do not move to phase 4 until all four sections are confirmed.

---

## Phase 4 -- Save the design

Assemble the confirmed sections into a single Markdown document, then
pipe it to the save script:

```bash
node scripts/save_design.mjs --title "<short title>" [--out <dir>]
```

The script reads the document from stdin, fills the template at
`references/DESIGN_TEMPLATE.md`, and writes
`DESIGN-<slug>-<YYYYMMDD-HHmm>.md` to `--out` (default: `./design/`).

It prints the absolute path of the written file on stdout. Share that
path with the user and stop.

---

## Anti-patterns

- Do **not** skip to phase 4 before sections are confirmed.
- Do **not** propose a single approach in phase 2.
- Do **not** write production code in this skill.
- Do **not** ask more than 5 questions in phase 1.
- Do **not** combine multiple sections in a single message in phase 3.
