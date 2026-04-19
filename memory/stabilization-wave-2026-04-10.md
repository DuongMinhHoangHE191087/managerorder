# Stabilization Wave 2026-04-10

## Scope

First stabilization wave on top of the current refactor workspace for `managerorder / premium-admin-web`.

## Locked priorities

1. Fix runtime 500 failures first.
2. Fix CSS token drift and responsive breakage.
3. Lock business correctness and prevent regression.
4. Expand features only after the platform is stable.

## Locked runtime direction

- Vercel is the primary production runtime.
- Telegram and Zalo polling remain local or fallback modes.
- Webhook or event-driven bot entrypoints are the preferred production path.

## Locked technical facts

- `typecheck`, `lint`, and `build` were green before this stabilization wave.
- Premium migrations had a real client runtime crash because a client page imported a helper that pulled `supabaseAdmin`.
- Provider -> purchase-order visual flow was already clean, so avoid unnecessary refactors there.
- CSS token drift existed around `bg-base`, `fg-primary`, `surface-1`, and `surface-base`.

## Changes shipped in this wave

- Added `server-only` boundaries to Supabase admin/server helpers and premium server helper code.
- Split reusable premium math into `src/lib/domain/premium-account-math.ts`.
- Patched `src/widgets/pages/premium/migrations/page-client.tsx` to use the pure math module.
- Replaced missing token usage in affected order and bot settings UI modules.
- Added compatibility aliases in `src/app/globals.css`.
- Added automated guards:
  - `scripts/check-client-boundaries.mjs`
  - `scripts/check-css-tokens.mjs`
  - `scripts/runtime-smoke.mjs`

## Working rules

- Read `memory/memory-conventions.md` and the current memory bank before deep repo reads.
- Wake up MemPalace and search the `managerorder` wing before rediscovering architecture facts.
- Client modules must not depend on `server-only`, secret `process.env`, or `supabaseAdmin`.
- API responses should converge on `{ data, meta? }` and `{ error, code?, details? }`.
- Components may only use CSS variables declared in `src/app/globals.css` or approved vendor prefixes.

## Preferred skills for future waves

- `mempalace`
- `typescript-expert`
- `build-web-apps:react-best-practices`
- `testing-automation-mcp`
