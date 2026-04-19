---
name: mempalace
description: Persistent cross-project memory using MemPalace for Codex. Use when a task needs recall of prior decisions, project context, preferences, or conversation history, or when wiring MCP memory into local agents.
allowed-tools: Read, Glob, Grep, Bash
---

# MemPalace

Use MemPalace as the durable memory layer for Codex.

## When to use

- Before editing a known project, check whether it already has a `memory/` bank.
- If a repo has `memory/memory-conventions.md`, read it first and follow its room/wing mapping.
- Before making architecture or product assumptions, search MemPalace for prior decisions or preferences.
- After a meaningful decision, update the project memory bank and ingest it into MemPalace when available.

## Core commands

- `mempalace init <project-dir>`: bootstrap a project wing.
- `mempalace wake-up [--wing <name>]`: load compact identity and facts.
- `mempalace search "<query>" [--wing <name>] [--room <name>]`: find prior decisions.
- `mempalace mine <dir> [--mode convos|projects] [--wing <name>]`: ingest project files or conversation exports.
- `mempalace status`: inspect the palace.

## Project convention

- Use the repo root as the ingest target.
- Use `wing_<repo-slug>` for the wing name.
- Preserve `memory/*.md` filenames as room names where possible.
- Prefer stable files for `productContext`, `activeContext`, `systemPatterns`, `techContext`, `progress`, and `agent_memory`.

## MCP setup

- Use `python -m mempalace.mcp_server` for MCP clients.
- Storage lives at the path configured by `MEMPALACE_PALACE_PATH`.
- If a project already has a local memory bank, treat it as the project-level source of truth and sync important facts into MemPalace.

## Operating rules

- Prefer recalled facts over guesswork.
- Treat raw conversation notes and project docs as higher value than summaries.
- Keep project facts and global preferences separate by wing or project.
- Narrow by wing or room before broad search when retrieval is noisy.
