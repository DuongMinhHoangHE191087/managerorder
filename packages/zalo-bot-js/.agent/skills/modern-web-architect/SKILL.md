---
name: modern-web-architect
description: >
  Master Frontend & Web Architecture. Combines React 19, Next.js 15, App Router, 
  State Management, and High-Craft UI Design. Includes FFCI and DFII evaluation frameworks.
---

# 🌐 Modern Web Architect (Master Skill)

You are a **Principal Frontend Architect and Design Engineer**. You build web applications that are technically flawless, performant, and visually stunning.

---

## 📑 Internal Menu
1. [Architecture & Feasibility (FFCI)](#1-architecture--feasibility-ffci)
2. [React 19 & Next.js 15 Patterns](#2-react-19--nextjs-15-patterns)
3. [State Management & Data Fetching](#3-state-management--data-fetching)
4. [High-Craft UI Design (DFII)](#4-high-craft-ui-design-dfii)
5. [Performance & Optimization](#5-performance--optimization)

---

## 1. Architecture & Feasibility (FFCI)
Before coding, calculate the **Frontend Feasibility & Complexity Index (FFCI)**:

`FFCI = (Architectural Fit + Reusability + Performance) − (Complexity + Maintenance)`

- **10-15**: Excellent - Proceed.
- **6-9**: Acceptable - Proceed with care.
- **< 6**: Redesign or simplify.

---

## 2. React 19 & Next.js 15 Patterns
- **App Router**: Use folder-based routing, parallel routes, and intercepting routes.
- **Server Components (RSC)**: Default to Server Components for data fetching. Use `'use client'` only for interactivity.
- **New Hooks**: Leverage `useActionState`, `useOptimistic`, and the `use` API.
- **Suspense-First**: Always wrap heavy components and data-fetching in `<Suspense>`. **No manual `isLoading` flags.**

---

## 3. State Management & Data Fetching
- **Server State**: Use **TanStack Query** (React Query) for caching and synchronization.
- **Local/Global**:
  - `useState` for component-level.
  - `Zustand` for complex global state.
  - `Context` for subtree configuration.
- **Doctrine**: "Props down, Actions up."

---

## 4. High-Craft UI Design (DFII)
Every UI must have an **Intentional Aesthetic** (e.g., Editorial Brutalism, Luxury Minimal).

Evaluate via **Design Feasibility & Impact Index (DFII)**:
`DFII = (Impact + Context Fit + Feasibility + Performance) − Consistency Risk`

- **Mandate**: 
  - ❌ No generic "AI UI" or default Tailwind/ShadCN layouts.
  - ✅ Custom typography, purposeful motion, and textured depth.
  - ✅ One "Memorable Anchor" per page.

---

## 5. Performance & Optimization
- **Code Splitting**: Dynamic imports (`React.lazy`) for heavy modules.
- **Rendering**: Optimize for Core Web Vitals (LCP < 2.5s, CLS < 0.1).
- **Images**: Use Next.js `<Image>` for automatic optimization.
- **Bundle**: Audit dependencies to avoid bloat.

---

## 🛠️ Execution Protocol

1. **Phase 1: Design Thinking**: Define Tone and Aesthetic Direction.
2. **Phase 2: Data Architecture**: Map Server vs. Client components.
3. **Phase 3: FFCI/DFII Check**: Ensure the project is viable and high-impact.
4. **Phase 4: Component Implementation**: Small, focused components; Props typing.
5. **Phase 5: Validation**: Performance audit and Accessibility check.

---
*Merged and optimized from 11 legacy frontend, React, and Next.js skills.*


<!-- MERGED FROM nextjs-app-router-patterns -->

---
version: 4.1.0-fractal
name: nextjs-app-router-patterns
description: Master Next.js 14+ App Router with Server Components, streaming, parallel routes, and advanced data fetching. Use when building Next.js applications, implementing SSR/SSG, or optimizing React Server Components.
---

# Next.js App Router Patterns

Comprehensive patterns for Next.js 14+ App Router architecture, Server Components, and modern full-stack React development.

## Use this skill when

- Building new Next.js applications with App Router
- Migrating from Pages Router to App Router
- Implementing Server Components and streaming
- Setting up parallel and intercepting routes
- Optimizing data fetching and caching
- Building full-stack features with Server Actions

## Do not use this skill when

- The task is unrelated to next.js app router patterns
- You need a different domain or tool outside this scope

## Instructions

- Clarify goals, constraints, and required inputs.
- Apply relevant best practices and validate outcomes.
- Provide actionable steps and verification.
- If detailed examples are required, open `resources/implementation-playbook.md`.

## Resources

- `resources/implementation-playbook.md` for detailed patterns and examples.


## 🧠 Knowledge Modules (Fractal Skills)

### 1. [implementation-playbook](./sub-skills/implementation-playbook.md)


<!-- MERGED FROM frontend-dev-guidelines -->

---
version: 4.1.0-fractal
name: frontend-dev-guidelines
description: Opinionated frontend development standards for modern React + TypeScript applications. Covers Suspense-first data fetching, lazy loading, feature-based architecture, MUI v7 styling, TanStack Router, performance optimization, and strict TypeScript practices.
---


# Frontend Development Guidelines

**(React · TypeScript · Suspense-First · Production-Grade)**

You are a **senior frontend engineer** operating under strict architectural and performance standards.

Your goal is to build **scalable, predictable, and maintainable React applications** using:

* Suspense-first data fetching
* Feature-based code organization
* Strict TypeScript discipline
* Performance-safe defaults

This skill defines **how frontend code must be written**, not merely how it *can* be written.

---

## 1. Frontend Feasibility & Complexity Index (FFCI)

Before implementing a component, page, or feature, assess feasibility.

### FFCI Dimensions (1–5)

| Dimension             | Question                                                         |
| --------------------- | ---------------------------------------------------------------- |
| **Architectural Fit** | Does this align with feature-based structure and Suspense model? |
| **Complexity Load**   | How complex is state, data, and interaction logic?               |
| **Performance Risk**  | Does it introduce rendering, bundle, or CLS risk?                |
| **Reusability**       | Can this be reused without modification?                         |
| **Maintenance Cost**  | How hard will this be to reason about in 6 months?               |

### Score Formula

```
FFCI = (Architectural Fit + Reusability + Performance) − (Complexity + Maintenance Cost)
```

**Range:** `-5 → +15`

### Interpretation

| FFCI      | Meaning    | Action            |
| --------- | ---------- | ----------------- |
| **10–15** | Excellent  | Proceed           |
| **6–9**   | Acceptable | Proceed with care |
| **3–5**   | Risky      | Simplify or split |
| **≤ 2**   | Poor       | Redesign          |

---

## 2. Core Architectural Doctrine (Non-Negotiable)

### 1. Suspense Is the Default

* `useSuspenseQuery` is the **primary** data-fetching hook
* No `isLoading` conditionals
* No early-return spinners

### 2. Lazy Load Anything Heavy

* Routes
* Feature entry components
* Data grids, charts, editors
* Large dialogs or modals

### 3. Feature-Based Organization

* Domain logic lives in `features/`
* Reusable primitives live in `components/`
* Cross-feature coupling is forbidden

### 4. TypeScript Is Strict

* No `any`
* Explicit return types
* `import type` always
* Types are first-class design artifacts

---

## 3. When to Use This Skill

Use **frontend-dev-guidelines** when:

* Creating components or pages
* Adding new features
* Fetching or mutating data
* Setting up routing
* Styling with MUI
* Addressing performance issues
* Reviewing or refactoring frontend code

---

## 4. Quick Start Checklists

### New Component Checklist

* [ ] `React.FC<Props>` with explicit props interface
* [ ] Lazy loaded if non-trivial
* [ ] Wrapped in `<SuspenseLoader>`
* [ ] Uses `useSuspenseQuery` for data
* [ ] No early returns
* [ ] Handlers wrapped in `useCallback`
* [ ] Styles inline if <100 lines
* [ ] Default export at bottom
* [ ] Uses `useMuiSnackbar` for feedback

---

### New Feature Checklist

* [ ] Create `features/{feature-name}/`
* [ ] Subdirs: `api/`, `components/`, `hooks/`, `helpers/`, `types/`
* [ ] API layer isolated in `api/`
* [ ] Public exports via `index.ts`
* [ ] Feature entry lazy loaded
* [ ] Suspense boundary at feature level
* [ ] Route defined under `routes/`

---

## 5. Import Aliases (Required)

| Alias         | Path             |
| ------------- | ---------------- |
| `@/`          | `src/`           |
| `~types`      | `src/types`      |
| `~components` | `src/components` |
| `~features`   | `src/features`   |

Aliases must be used consistently. Relative imports beyond one level are discouraged.

---

## 6. Component Standards

### Required Structure Order

1. Types / Props
2. Hooks
3. Derived values (`useMemo`)
4. Handlers (`useCallback`)
5. Render
6. Default export

### Lazy Loading Pattern

```ts
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));
```

Always wrapped in `<SuspenseLoader>`.

---

## 7. Data Fetching Doctrine

### Primary Pattern

* `useSuspenseQuery`
* Cache-first
* Typed responses

### Forbidden Patterns

❌ `isLoading`
❌ manual spinners
❌ fetch logic inside components
❌ API calls without feature API layer

### API Layer Rules

* One API file per feature
* No inline axios calls
* No `/api/` prefix in routes

---

## 8. Routing Standards (TanStack Router)

* Folder-based routing only
* Lazy load route components
* Breadcrumb metadata via loaders

```ts
export const Route = createFileRoute('/my-route/')({
  component: MyPage,
  loader: () => ({ crumb: 'My Route' }),
});
```

---

## 9. Styling Standards (MUI v7)

### Inline vs Separate

* `<100 lines`: inline `sx`
* `>100 lines`: `{Component}.styles.ts`

### Grid Syntax (v7 Only)

```tsx
<Grid size={{ xs: 12, md: 6 }} /> // ✅
<Grid xs={12} md={6} />          // ❌
```

Theme access must always be type-safe.

---

## 10. Loading & Error Handling

### Absolute Rule

❌ Never return early loaders
✅ Always rely on Suspense boundaries

### User Feedback

* `useMuiSnackbar` only
* No third-party toast libraries

---

## 11. Performance Defaults

* `useMemo` for expensive derivations
* `useCallback` for passed handlers
* `React.memo` for heavy pure components
* Debounce search (300–500ms)
* Cleanup effects to avoid leaks

Performance regressions are bugs.

---

## 12. TypeScript Standards

* Strict mode enabled
* No implicit `any`
* Explicit return types
* JSDoc on public interfaces
* Types colocated with feature

---

## 13. Canonical File Structure

```
src/
  features/
    my-feature/
      api/
      components/
      hooks/
      helpers/
      types/
      index.ts

  components/
    SuspenseLoader/
    CustomAppBar/

  routes/
    my-route/
      index.tsx
```

---

## 14. Canonical Component Template

```ts
import React, { useState, useCallback } from 'react';
import { Box, Paper } from '@mui/material';
import { useSuspenseQuery } from '@tanstack/react-query';
import { featureApi } from '../api/featureApi';
import type { FeatureData } from '~types/feature';

interface MyComponentProps {
  id: number;
  onAction?: () => void;
}

export const MyComponent: React.FC<MyComponentProps> = ({ id, onAction }) => {
  const [state, setState] = useState('');

  const { data } = useSuspenseQuery<FeatureData>({
    queryKey: ['feature', id],
    queryFn: () => featureApi.getFeature(id),
  });

  const handleAction = useCallback(() => {
    setState('updated');
    onAction?.();
  }, [onAction]);

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 3 }}>
        {/* Content */}
      </Paper>
    </Box>
  );
};

export default MyComponent;
```

---

## 15. Anti-Patterns (Immediate Rejection)

❌ Early loading returns
❌ Feature logic in `components/`
❌ Shared state via prop drilling instead of hooks
❌ Inline API calls
❌ Untyped responses
❌ Multiple responsibilities in one component

---

## 16. Integration With Other Skills

* **frontend-design** → Visual systems & aesthetics
* **page-cro** → Layout hierarchy & conversion logic
* **analytics-tracking** → Event instrumentation
* **backend-dev-guidelines** → API contract alignment
* **error-tracking** → Runtime observability

---

## 17. Operator Validation Checklist

Before finalizing code:

* [ ] FFCI ≥ 6
* [ ] Suspense used correctly
* [ ] Feature boundaries respected
* [ ] No early returns
* [ ] Types explicit and correct
* [ ] Lazy loading applied
* [ ] Performance safe

---

## 18. Skill Status

**Status:** Stable, opinionated, and enforceable
**Intended Use:** Production React codebases with long-term maintenance horizons



## 🧠 Knowledge Modules (Fractal Skills)

### 1. [common-patterns](./sub-skills/common-patterns.md)
### 2. [complete-examples](./sub-skills/complete-examples.md)
### 3. [component-patterns](./sub-skills/component-patterns.md)
### 4. [data-fetching](./sub-skills/data-fetching.md)
### 5. [file-organization](./sub-skills/file-organization.md)
### 6. [loading-and-error-states](./sub-skills/loading-and-error-states.md)
### 7. [performance](./sub-skills/performance.md)
### 8. [routing-guide](./sub-skills/routing-guide.md)
### 9. [styling-guide](./sub-skills/styling-guide.md)
### 10. [typescript-standards](./sub-skills/typescript-standards.md)


<!-- MERGED FROM frontend-design -->

---
name: frontend-design
description: Design thinking and decision-making for web UI.
category: design
version: 4.1.0-fractal
layer: master-skill
---

# Frontend Design System

> **Philosophy:** Every pixel has purpose. Restraint is luxury. User psychology drives decisions.
> **Core Principle:** THINK, don't memorize. ASK, don't assume.

---

## 🎯 Selective Reading Rule (MANDATORY)

**Read REQUIRED files always, OPTIONAL only when needed:**

| File | Status | When to Read |
|------|--------|--------------|
| [ux-psychology.md](ux-psychology.md) | 🔴 **REQUIRED** | Always read first! |
| [color-system.md](color-system.md) | ⚪ Optional | Color/palette decisions |
| [typography-system.md](typography-system.md) | ⚪ Optional | Font selection/pairing |
| [visual-effects.md](visual-effects.md) | ⚪ Optional | Glassmorphism, shadows, gradients |
| [animation-guide.md](animation-guide.md) | ⚪ Optional | Animation needed |
| [motion-graphics.md](motion-graphics.md) | ⚪ Optional | Lottie, GSAP, 3D |
| [decision-trees.md](decision-trees.md) | ⚪ Optional | Context templates |

> 🔴 **ux-psychology.md = ALWAYS READ. Others = only if relevant.**

---

## 🔧 Runtime Scripts

**Execute these for audits (don't read, just run):**

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/ux_audit.py` | UX Psychology & Accessibility Audit | `python scripts/ux_audit.py <project_path>` |

---

## ⚠️ CRITICAL: ASK BEFORE ASSUMING (MANDATORY)

> **STOP! If the user's request is open-ended, DO NOT default to your favorites.**

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [When User Prompt is Vague, ASK:](./sub-skills/when-user-prompt-is-vague-ask.md)
### 2. [⛔ DEFAULT TENDENCIES TO AVOID (ANTI-SAFE HARBOR):](./sub-skills/default-tendencies-to-avoid-anti-safe-harbor.md)
### 3. [Audience → Design Approach](./sub-skills/audience-design-approach.md)
### 4. [Core Laws (Internalize These)](./sub-skills/core-laws-internalize-these.md)
### 5. [Emotional Design Levels](./sub-skills/emotional-design-levels.md)
### 6. [Trust Building](./sub-skills/trust-building.md)
### 7. [Golden Ratio (φ = 1.618)](./sub-skills/golden-ratio-1618.md)
### 8. [8-Point Grid Concept](./sub-skills/8-point-grid-concept.md)
### 9. [Key Sizing Principles](./sub-skills/key-sizing-principles.md)
### 10. [60-30-10 Rule](./sub-skills/60-30-10-rule.md)
### 11. [Color Psychology (For Decision Making)](./sub-skills/color-psychology-for-decision-making.md)
### 12. [Selection Process](./sub-skills/selection-process.md)
### 13. [Scale Selection](./sub-skills/scale-selection.md)
### 14. [Pairing Concept](./sub-skills/pairing-concept.md)
### 15. [Readability Rules](./sub-skills/readability-rules.md)
### 16. [Glassmorphism (When Appropriate)](./sub-skills/glassmorphism-when-appropriate.md)
### 17. [Shadow Hierarchy](./sub-skills/shadow-hierarchy.md)
### 18. [Gradient Usage](./sub-skills/gradient-usage.md)
### 19. [Timing Concept](./sub-skills/timing-concept.md)
### 20. [Easing Selection](./sub-skills/easing-selection.md)
### 21. [Performance](./sub-skills/performance.md)
### 22. [Premium Indicators](./sub-skills/premium-indicators.md)
### 23. [Trust Builders](./sub-skills/trust-builders.md)
### 24. [Emotional Triggers](./sub-skills/emotional-triggers.md)
### 25. [❌ Lazy Design Indicators](./sub-skills/lazy-design-indicators.md)
### 26. [❌ AI Tendency Patterns (AVOID!)](./sub-skills/ai-tendency-patterns-avoid.md)
### 27. [❌ Dark Patterns (Unethical)](./sub-skills/dark-patterns-unethical.md)


<!-- MERGED FROM ui-ux-pro-max -->

---
name: ui-ux-pro-max
description: UI/UX design intelligence. 50 styles, 21 palettes, 50 font pairings, 20 charts, 9 stacks.
---
# ui-ux-pro-max

Comprehensive design guide for web and mobile applications. Contains 67 styles, 96 color palettes, 57 font pairings, 99 UX guidelines, and 25 chart types across 13 technology stacks. Searchable database with priority-based recommendations.

## Prerequisites

Check if Python is installed:

```bash
python3 --version || python --version
```

If Python is not installed, install it based on user's OS:

**macOS:**
```bash
brew install python3
```

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install python3
```

**Windows:**
```powershell
winget install Python.Python.3.12
```

---

## How to Use This Skill

When user requests UI/UX work (design, build, create, implement, review, fix, improve), follow this workflow:

### Step 1: Analyze User Requirements

Extract key information from user request:
- **Product type**: SaaS, e-commerce, portfolio, dashboard, landing page, etc.
- **Style keywords**: minimal, playful, professional, elegant, dark mode, etc.
- **Industry**: healthcare, fintech, gaming, education, etc.
- **Stack**: React, Vue, Next.js, or default to `html-tailwind`

### Step 2: Generate Design System (REQUIRED)

**Always start with `--design-system`** to get comprehensive recommendations with reasoning:

```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<product_type> <industry> <keywords>" --design-system [-p "Project Name"]
```

This command:
1. Searches 5 domains in parallel (product, style, color, landing, typography)
2. Applies reasoning rules from `ui-reasoning.csv` to select best matches
3. Returns complete design system: pattern, style, colors, typography, effects
4. Includes anti-patterns to avoid

**Example:**
```bash
python3 skills/ui-ux-pro-max/scripts/search.py "beauty spa wellness service" --design-system -p "Serenity Spa"
```

### Step 2b: Persist Design System (Master + Overrides Pattern)

To save the design system for hierarchical retrieval across sessions, add `--persist`:

```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name"
```

This creates:
- `design-system/MASTER.md` — Global Source of Truth with all design rules
- `design-system/pages/` — Folder for page-specific overrides

**With page-specific override:**
```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name" --page "dashboard"
```

This also creates:
- `design-system/pages/dashboard.md` — Page-specific deviations from Master

**How hierarchical retrieval works:**
1. When building a specific page (e.g., "Checkout"), first check `design-system/pages/checkout.md`
2. If the page file exists, its rules **override** the Master file
3. If not, use `design-system/MASTER.md` exclusively

### Step 3: Supplement with Detailed Searches (as needed)

After getting the design system, use domain searches to get additional details:

```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain> [-n <max_results>]
```

**When to use detailed searches:**

| Need | Domain | Example |
|------|--------|---------|
| More style options | `style` | `--domain style "glassmorphism dark"` |
| Chart recommendations | `chart` | `--domain chart "real-time dashboard"` |
| UX best practices | `ux` | `--domain ux "animation accessibility"` |
| Alternative fonts | `typography` | `--domain typography "elegant luxury"` |
| Landing structure | `landing` | `--domain landing "hero social-proof"` |

### Step 4: Stack Guidelines (Default: html-tailwind)

Get implementation-specific best practices. If user doesn't specify a stack, **default to `html-tailwind`**.

```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<keyword>" --stack html-tailwind
```

Available stacks: `html-tailwind`, `react`, `nextjs`, `vue`, `svelte`, `swiftui`, `react-native`, `flutter`, `shadcn`, `jetpack-compose`

---

## Search Reference

### Available Domains

| Domain | Use For | Example Keywords |
|--------|---------|------------------|
| `product` | Product type recommendations | SaaS, e-commerce, portfolio, healthcare, beauty, service |
| `style` | UI styles, colors, effects | glassmorphism, minimalism, dark mode, brutalism |
| `typography` | Font pairings, Google Fonts | elegant, playful, professional, modern |
| `color` | Color palettes by product type | saas, ecommerce, healthcare, beauty, fintech, service |
| `landing` | Page structure, CTA strategies | hero, hero-centric, testimonial, pricing, social-proof |
| `chart` | Chart types, library recommendations | trend, comparison, timeline, funnel, pie |
| `ux` | Best practices, anti-patterns | animation, accessibility, z-index, loading |
| `react` | React/Next.js performance | waterfall, bundle, suspense, memo, rerender, cache |
| `web` | Web interface guidelines | aria, focus, keyboard, semantic, virtualize |
| `prompt` | AI prompts, CSS keywords | (style name) |

### Available Stacks

| Stack | Focus |
|-------|-------|
| `html-tailwind` | Tailwind utilities, responsive, a11y (DEFAULT) |
| `react` | State, hooks, performance, patterns |
| `nextjs` | SSR, routing, images, API routes |
| `vue` | Composition API, Pinia, Vue Router |
| `svelte` | Runes, stores, SvelteKit |
| `swiftui` | Views, State, Navigation, Animation |
| `react-native` | Components, Navigation, Lists |
| `flutter` | Widgets, State, Layout, Theming |
| `shadcn` | shadcn/ui components, theming, forms, patterns |
| `jetpack-compose` | Composables, Modifiers, State Hoisting, Recomposition |

---

## Example Workflow

**User request:** "Làm landing page cho dịch vụ chăm sóc da chuyên nghiệp"

### Step 1: Analyze Requirements
- Product type: Beauty/Spa service
- Style keywords: elegant, professional, soft
- Industry: Beauty/Wellness
- Stack: html-tailwind (default)

### Step 2: Generate Design System (REQUIRED)

```bash
python3 skills/ui-ux-pro-max/scripts/search.py "beauty spa wellness service elegant" --design-system -p "Serenity Spa"
```

**Output:** Complete design system with pattern, style, colors, typography, effects, and anti-patterns.

### Step 3: Supplement with Detailed Searches (as needed)

```bash
# Get UX guidelines for animation and accessibility
python3 skills/ui-ux-pro-max/scripts/search.py "animation accessibility" --domain ux

# Get alternative typography options if needed
python3 skills/ui-ux-pro-max/scripts/search.py "elegant luxury serif" --domain typography
```

### Step 4: Stack Guidelines

```bash
python3 skills/ui-ux-pro-max/scripts/search.py "layout responsive form" --stack html-tailwind
```

**Then:** Synthesize design system + detailed searches and implement the design.

---

## Output Formats

The `--design-system` flag supports two output formats:

```bash
# ASCII box (default) - best for terminal display
python3 skills/ui-ux-pro-max/scripts/search.py "fintech crypto" --design-system

# Markdown - best for documentation
python3 skills/ui-ux-pro-max/scripts/search.py "fintech crypto" --design-system -f markdown
```

---

## Tips for Better Results

1. **Be specific with keywords** - "healthcare SaaS dashboard" > "app"
2. **Search multiple times** - Different keywords reveal different insights
3. **Combine domains** - Style + Typography + Color = Complete design system
4. **Always check UX** - Search "animation", "z-index", "accessibility" for common issues
5. **Use stack flag** - Get implementation-specific best practices
6. **Iterate** - If first search doesn't match, try different keywords

---

## Common Rules for Professional UI

These are frequently overlooked issues that make UI look unprofessional:

### Icons & Visual Elements

| Rule | Do | Don't |
|------|----|----- |
| **No emoji icons** | Use SVG icons (Heroicons, Lucide, Simple Icons) | Use emojis like 🎨 🚀 ⚙️ as UI icons |
| **Stable hover states** | Use color/opacity transitions on hover | Use scale transforms that shift layout |
| **Correct brand logos** | Research official SVG from Simple Icons | Guess or use incorrect logo paths |
| **Consistent icon sizing** | Use fixed viewBox (24x24) with w-6 h-6 | Mix different icon sizes randomly |

### Interaction & Cursor

| Rule | Do | Don't |
|------|----|----- |
| **Cursor pointer** | Add `cursor-pointer` to all clickable/hoverable cards | Leave default cursor on interactive elements |
| **Hover feedback** | Provide visual feedback (color, shadow, border) | No indication element is interactive |
| **Smooth transitions** | Use `transition-colors duration-200` | Instant state changes or too slow (>500ms) |

### Light/Dark Mode Contrast

| Rule | Do | Don't |
|------|----|----- |
| **Glass card light mode** | Use `bg-white/80` or higher opacity | Use `bg-white/10` (too transparent) |
| **Text contrast light** | Use `#0F172A` (slate-900) for text | Use `#94A3B8` (slate-400) for body text |
| **Muted text light** | Use `#475569` (slate-600) minimum | Use gray-400 or lighter |
| **Border visibility** | Use `border-gray-200` in light mode | Use `border-white/10` (invisible) |

### Layout & Spacing

| Rule | Do | Don't |
|------|----|----- |
| **Floating navbar** | Add `top-4 left-4 right-4` spacing | Stick navbar to `top-0 left-0 right-0` |
| **Content padding** | Account for fixed navbar height | Let content hide behind fixed elements |
| **Consistent max-width** | Use same `max-w-6xl` or `max-w-7xl` | Mix different container widths |

---

## Pre-Delivery Checklist

Before delivering UI code, verify these items:

### Visual Quality
- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] Brand logos are correct (verified from Simple Icons)
- [ ] Hover states don't cause layout shift
- [ ] Use theme colors directly (bg-primary) not var() wrapper

### Interaction
- [ ] All clickable elements have `cursor-pointer`
- [ ] Hover states provide clear visual feedback
- [ ] Transitions are smooth (150-300ms)
- [ ] Focus states visible for keyboard navigation

### Light/Dark Mode
- [ ] Light mode text has sufficient contrast (4.5:1 minimum)
- [ ] Glass/transparent elements visible in light mode
- [ ] Borders visible in both modes
- [ ] Test both modes before delivery

### Layout
- [ ] Floating elements have proper spacing from edges
- [ ] No content hidden behind fixed navbars
- [ ] Responsive at 375px, 768px, 1024px, 1440px
- [ ] No horizontal scroll on mobile

### Accessibility
- [ ] All images have alt text
- [ ] Form inputs have labels
- [ ] Color is not the only indicator
- [ ] `prefers-reduced-motion` respected


<!-- MERGED FROM frontend-trends-2026 -->

---
name: frontend-trends-2026
description: Collection of 2026 Frontend Design Formulas (Liquid Glass, Bento, Neo-Brutalism, Eco-Dark).
category: ui-ux
version: 1.0.0
layer: specialized-skill
---

# Frontend Design Formulas (2026)

> **Purpose**: Provide production-ready, trend-setting UI patterns for 2026 web applications.
> **Tech Stack**: React 19+, Tailwind CSS v4, CSS Modules (optional), Shadcn/ui.

## 🎨 1. Aesthetic Formulas (Giao diện)

### Formula A: Liquid Glass (Kính Lỏng)
*Use for: Modals, Cards, Sticky Headers.*
- **Core**: `backdrop-filter: blur(16px) saturate(180%)`
- **Surface**: `bg-white/10` (Light) or `bg-black/20` (Dark)
- **Border**: `border border-white/20` (Thin, subtle)
- **Shadow**: `shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]` (Soft colored shadow)
- **Noise**: Add a subtle noise texture overlay `opacity-5`.

### Formula B: Neo-Brutalism 2.0 (Thô mộc Hiện đại)
*Use for: SaaS Dashboards, Developer Tools, Linear-style apps.*
- **Contrast**: High (Black & White base + 1 Neon Accent).
- **Border**: `border-2 border-slate-900` (Sharp, bold).
- **Shadow**: `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]` (Hard offset shadow).
- **Typography**: Inter (Tight tracking) or Space Mono.
- **Radius**: `rounded-md` or `rounded-none` (No pills).

### Formula C: Eco-Dark Mode (Tiết kiệm năng lượng)
*Use for: Mobile Apps, Constantly-on screens.*
- **Bg Base**: `#000000` (Pure Black for OLED) or `#050505`.
- **Primary Text**: `text-slate-200` (Avoid pure white `#FFF` -> Eye strain).
- **Accent**: Use OKLCH colors for vibrancy without heavy brightness.

## 📐 2. Layout Formulas (Bố cục)

### Formula D: Bento Grid (Hộp Cơm)
*Use for: Feature Showcases, Analytics, Portfolio.*
- **CSS Grid**: `grid-cols-1 md:grid-cols-3 gap-4`.
- **Spans**: Use `col-span-2` or `row-span-2` to create hierarchy.
- **Content**: Visual-heavy (Image/Chart) + Minimal Text.
- **Hover**: Subtle scale `hover:scale-[1.02]` + Border glow.

### Formula E: Container Queries (Card thông minh)
*Use for: Reusable Components in unknown layouts.*
- **Parent**: `container-type: inline-size`.
- **Child CSS**: `@container (min-width: 400px) { ... }`.
- **Benefit**: Component adapts to *slot* size, not screen size.

## ✨ 3. Interaction Formulas (Tương tác)

### Formula F: Scroll-Driven Animation
*Use for: Landing Pages, Storytelling.*
- **Tech**: Native CSS `animation-timeline: scroll()`.
- **Effect**: Elements fade in, slide up, or scale based on scroll position.
- **Perf**: Runs on Compositor Thread (No JS Jank).

### Formula G: Spring Physics (Vật lý)
*Use for: Popovers, Drawers, Toggles.*
- **Feel**: Bouncy, snappy, organic.
- **Libraries**: `framer-motion` (presets like `type: "spring", stiffness: 300, damping: 20`).
- **CSS Alternative**: `transition-timing-function: cubic-bezier(0.175, 0.885, 0.32, 1.275)`.

## 📜 Agent Instructions for Usage

1.  **Identify Context**: Choose Formula based on User Request (e.g., "Modern Dashboard" -> Neo-Brutalism + Bento).
2.  **Apply Tokens**: Use Tailwind classes listed in formulas.
3.  **Code Snippets**: Check `formulas/` directory for ready-to-use React components. Do NOT reinvent wheels.

---

**Example Request:**
> "Make a modern landing page for my AI tool."
**Agent Action:**
> Apply **Formula A (Liquid Glass)** for Header, **Formula D (Bento Grid)** for Features, and **Formula F** for animations.


<!-- MERGED FROM tailwind-patterns -->

---
name: tailwind-patterns
description: Tailwind CSS v4 principles and modern design tokens.
category: design
version: 4.1.0-fractal
layer: master-skill
---

# Tailwind CSS Patterns (v4 - 2025)

> Modern utility-first CSS with CSS-native configuration.

---

## 1. Tailwind v4 Architecture

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [What Changed from v3](./sub-skills/what-changed-from-v3.md)
### 2. [v4 Core Concepts](./sub-skills/v4-core-concepts.md)
### 3. [Theme Definition](./sub-skills/theme-definition.md)
### 4. [When to Extend vs Override](./sub-skills/when-to-extend-vs-override.md)
### 5. [Breakpoint vs Container](./sub-skills/breakpoint-vs-container.md)
### 6. [Container Query Usage](./sub-skills/container-query-usage.md)
### 7. [When to Use](./sub-skills/when-to-use.md)
### 8. [Breakpoint System](./sub-skills/breakpoint-system.md)
### 9. [Mobile-First Principle](./sub-skills/mobile-first-principle.md)
### 10. [Configuration Strategies](./sub-skills/configuration-strategies.md)
### 11. [Dark Mode Pattern](./sub-skills/dark-mode-pattern.md)
### 12. [Flexbox Patterns](./sub-skills/flexbox-patterns.md)
### 13. [Grid Patterns](./sub-skills/grid-patterns.md)
### 14. [OKLCH vs RGB/HSL](./sub-skills/oklch-vs-rgbhsl.md)
### 15. [Color Token Architecture](./sub-skills/color-token-architecture.md)
### 16. [Font Stack Pattern](./sub-skills/font-stack-pattern.md)
### 17. [Type Scale](./sub-skills/type-scale.md)
### 18. [Built-in Animations](./sub-skills/built-in-animations.md)
### 19. [Transition Patterns](./sub-skills/transition-patterns.md)
### 20. [When to Extract](./sub-skills/when-to-extract.md)
### 21. [Extraction Methods](./sub-skills/extraction-methods.md)

