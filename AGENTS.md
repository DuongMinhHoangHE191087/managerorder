# ManagerOrder Agent Rules

## Source Of Truth

- `README.md`
- `docs/architecture.md`
- `.context/coding_style.md` for style and rigor; adapt any language-specific guidance to the current stack
- `.context/project-memory.md` for verbatim project memory
- `.context/project-graph.md` for compact entity/relation context

## Canonical Scope

- `apps/admin-web` is the canonical admin app.
- `packages/zalo-bot-js` is the canonical bot package.
- `apps/admin-web/src/app` owns route handlers and API routes.
- `apps/admin-web/src/lib` owns domain rules, services, adapters, repositories, and infra helpers.
- `apps/admin-web/src/widgets` owns page composition and UI behavior.
- `tooling` owns shared lint and test configuration.
- The old root `src/` tree and any nested legacy app are not the source of truth.

## Change Rules

- Inspect the nearest relevant files before editing.
- Keep route handlers thin. Put business logic in domain/service modules.
- Default to tenant-safe helpers. Use `supabaseAdmin` only for explicitly allowlisted system work.
- Keep deprecated or break-glass routes disabled unless a feature flag and auth policy explicitly allow them.
- Update dependent files, tests, and docs in the same change when a contract changes.
- Keep changes small and direct. Do not add abstractions unless they remove real duplication or risk.
- Keep shell output compact. Prefer targeted reads, summaries, and filtered logs over raw dumps.
- Stop broad exploration early. After a few commands, either act on the evidence or ask for a narrower target.
- After each meaningful command or discovery, write the delta to `.context/project-memory.md` and `.context/project-graph.md` before continuing.

## Verification

- Use the root gates when a change is non-trivial:
  - `corepack pnpm lint`
  - `corepack pnpm typecheck`
  - `corepack pnpm test`
  - `corepack pnpm build`
  - `corepack pnpm audit:prod`
- For broader repository work, `corepack pnpm check` is the release gate.
- Do not mark work done until the relevant validation passes.

## Skill Routing

Use the most specific existing skill first:

- TypeScript and monorepo issues: `.agents/typescript-expert/SKILL.md`
- Cleanups and naming: `.agents/clean-code/SKILL.md`
- New behavior or bug fixes: `.agents/tdd-master-workflow/SKILL.md`
- Validation and static checks: `.agents/lint-and-validate/SKILL.md`
- UI and frontend architecture: `.agents/modern-web-architect/SKILL.md`
- UI audits: `.agents/web-design-guidelines/SKILL.md`
- Reviews, security, and performance: `.agents/production-code-audit/SKILL.md`
- Git, commits, and PR flow: `.agents/git-collaboration-master/SKILL.md`
- Server/runtime concerns: `.agents/server-management/SKILL.md`
- Database/schema work: `.agents/database-design/SKILL.md`
- Token-efficient shell workflow: `~/.codex/skills/rtk-token-optimization/SKILL.md`
- Behavioral coding discipline: `~/.codex/skills/karpathy-guidelines/SKILL.md`
- Durable project memory: `~/.codex/skills/project-memory-palace/SKILL.md`
- Compact project graph: `~/.codex/skills/project-knowledge-graph/SKILL.md`
