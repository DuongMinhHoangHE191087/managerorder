# MemPalace Memory Conventions

## Canonical repo layout

Use this folder as the default project memory bank:

```text
memory/
  activeContext.md
  agent_memory.md
  memory-conventions.md
  productContext.md
  progress.md
  systemPatterns.md
  techContext.md
```

## Room mapping

- `productContext.md`: product purpose, users, domain entities, business rules.
- `activeContext.md`: current phase, last completed work, known issues, next focus.
- `systemPatterns.md`: architecture, invariants, patterns, decision records.
- `techContext.md`: stack, services, commands, environment notes.
- `progress.md`: recent milestones and delivery history.
- `agent_memory.md`: append-only session memory and short-lived notes.
- `memory-conventions.md`: the canonical rules for reading and writing the bank.

## Wing naming

- Use `wing_<repo-slug>` for one repo.
- For monorepos, use `wing_<repo-slug>-<package-slug>` when separate packages need separate recall.
- Keep wings stable across machines and clones.

## Ingestion rules

- Read `memory/memory-conventions.md` first if it exists.
- Prefer `mempalace init <repo> --yes` before first ingest.
- Prefer `mempalace mine <repo> --mode projects --wing <wing>` for code and docs.
- For chat exports, use `--mode convos`.
- Use the repo root as the default ingest target unless the repo explicitly narrows to a subfolder.

## Update rules

- Put stable facts in `productContext`, `systemPatterns`, and `techContext`.
- Put transient state in `activeContext` and `progress`.
- Use append-only updates for history; do not rewrite old facts unless they were wrong.

## Working rules added on 2026-04-10

- Before reading a large part of the repo, read this file and the project memory bank first.
- Wake up MemPalace and search the project wing before re-discovering known architecture or prior decisions.
- Prefer targeted file reads over whole-repo scans when the memory bank already narrows the area.
- After a meaningful architecture or stabilization change, update the local memory bank first, then sync to MemPalace.
