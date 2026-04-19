# Understand Skills Knowledge Map

This map groups the `understand-*` skills into one workflow so the repo can be analyzed, explored, compared, explained, and onboarded consistently.

## Skill Roles

| Skill | Purpose | Output |
| --- | --- | --- |
| `understand` | Full codebase analysis | `.understand-anything/knowledge-graph.json` |
| `understand-chat` | Ask questions against the graph | Targeted answers from graph nodes and edges |
| `understand-dashboard` | Visual graph exploration | Local dashboard pointed at the graph |
| `understand-diff` | Analyze code changes against the graph | Diff summary and `.understand-anything/diff-overlay.json` |
| `understand-explain` | Deep dive into one file, class, or function | Detailed component explanation |
| `understand-onboard` | Generate project onboarding material | High-level onboarding guide |

## Recommended Flow

1. Run `understand` first to build the graph.
2. Use `understand-dashboard` to inspect architecture visually.
3. Use `understand-chat` for fast questions about relationships.
4. Use `understand-explain` when a single file or module needs a deep read.
5. Use `understand-diff` after changes to see impact and risk.
6. Use `understand-onboard` to create a newcomer guide from the graph.

## Knowledge Areas

### 1. Project Shape

Covered by `understand` and `understand-onboard`.

- Repository layout
- Languages and frameworks
- Architecture layers
- Key files and modules

### 2. Dependency Graph

Covered by `understand`, `understand-chat`, and `understand-explain`.

- Imports
- Call chains
- Containment
- Layer boundaries

### 3. Change Impact

Covered by `understand-diff`.

- Changed files
- Affected nodes
- Blast radius
- Cross-layer risk

### 4. Visual Navigation

Covered by `understand-dashboard`.

- Knowledge graph browsing
- Architecture overview
- Overlay comparison for diffs

### 5. Team Ramp-Up

Covered by `understand-onboard`.

- Guided tour
- Complexity hotspots
- File map by layer
- Reading order for new contributors

## Canonical Graph Artifacts

- `.understand-anything/knowledge-graph.json`
- `.understand-anything/meta.json`
- `.understand-anything/diff-overlay.json`
- `.understand-anything/intermediate/`

## Suggested Skill Routing

- “What does this repo do?” -> `understand-onboard`
- “Where is X connected?” -> `understand-chat`
- “What changed and what is risky?” -> `understand-diff`
- “Explain this file in detail” -> `understand-explain`
- “Show me the architecture visually” -> `understand-dashboard`
- “Build or refresh the graph” -> `understand`

## Notes

- Keep the graph and dashboard in sync after code changes.
- Prefer the graph as the source of truth for architecture questions.
- If the graph is stale, rebuild with `understand` before asking higher-level questions.
