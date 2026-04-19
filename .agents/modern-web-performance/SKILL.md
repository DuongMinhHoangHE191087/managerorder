---
name: modern-web-performance
description: High-Performance Web Engineering.
category: performance
version: 4.1.0-fractal
layer: master-skill
---

# ⚡ High-Performance Web Engineering
> **Source**: Vercel Best Practices / Anthony Fu (Antfu) Engineering Standards

This skill focuses on "Elite-Level" web development: speed, zero-config DX, and scalable architecture.

## 🚀 1. The Vercel Way (Modern Stack)
- **Edge-First Thinking**: Prioritize logic that runs on the Edge (Middleware, Edge Functions) to reduce TTFB.
- **Incremental Static Regeneration (ISR)**: Update static content without a full rebuild.
- **Server Component Patterns**: Minimize client-side JS. Use `use server` sparingly and only where needed.

## 🛠️ 2. Antfu-Grade Developer Experience (DX)
- **Zero-Config Philosophy**: Use modern tools like `Vite`, `Vitest`, and `ESLint (flat config)` to minimize boilerplate.
- **Composable Logic**: Build small, single-responsibility functions (Vue Composables or React Hooks) that are highly unit-testable.
- **Type-Safety Everywhere**: No `any`. Use Zod for runtime validation and strict TS configs.

## 📦 3. Monorepo & Scalability
- **Turborepo Master**: Manage multi-package projects with intelligent caching and parallel execution.
- **Shared UI Libraries**: Split the UI into a separate package within the monorepo for reuse across Web/Mobile.
- **Package Modernization**: Migrate from CJS to ESM. Ensure `package.json` exports are correctly defined.

## 🧪 4. Performance Auditing
- **Core Web Vitals**: Monitor LCP, FID, and CLS. Chasing "100" on PageSpeed Insights is the goal.
- **Bundle Analysis**: Use tools to find and remove "heavy" dependencies.
- **Preload/Prefetch Strategies**: Optimize asset loading for critical paths.

---
*Created by Antigravity Orchestrator - Powered by Elite Web Ecosystem Wisdom.*


<!-- MERGED FROM web-performance-optimization -->

---
version: 4.1.0-fractal
name: web-performance-optimization
description: "Optimize website and web application performance including loading speed, Core Web Vitals, bundle size, caching strategies, and runtime performance"
---

# Web Performance Optimization

## Overview

Help developers optimize website and web application performance to improve user experience, SEO rankings, and conversion rates. This skill provides systematic approaches to measure, analyze, and improve loading speed, runtime performance, and Core Web Vitals metrics.

## When to Use This Skill

- Use when website or app is loading slowly
- Use when optimizing for Core Web Vitals (LCP, FID, CLS)
- Use when reducing JavaScript bundle size
- Use when improving Time to Interactive (TTI)
- Use when optimizing images and assets
- Use when implementing caching strategies
- Use when debugging performance bottlenecks
- Use when preparing for performance audits

## How It Works

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [Step 1: Measure Current Performance](./sub-skills/step-1-measure-current-performance.md)
### 2. [Step 2: Identify Issues](./sub-skills/step-2-identify-issues.md)
### 3. [Step 3: Prioritize Optimizations](./sub-skills/step-3-prioritize-optimizations.md)
### 4. [Step 4: Implement Optimizations](./sub-skills/step-4-implement-optimizations.md)
### 5. [Step 5: Verify Improvements](./sub-skills/step-5-verify-improvements.md)
### 6. [Example 1: Optimizing Core Web Vitals](./sub-skills/example-1-optimizing-core-web-vitals.md)
### 7. [Current Metrics (Before Optimization)](./sub-skills/current-metrics-before-optimization.md)
### 8. [Issues Identified](./sub-skills/issues-identified.md)
### 9. [Optimization Plan](./sub-skills/optimization-plan.md)
### 10. [Results After Optimization](./sub-skills/results-after-optimization.md)
### 11. [Example 2: Reducing JavaScript Bundle Size](./sub-skills/example-2-reducing-javascript-bundle-size.md)
### 12. [Current State](./sub-skills/current-state.md)
### 13. [Analysis](./sub-skills/analysis.md)
### 14. [Optimization Steps](./sub-skills/optimization-steps.md)
### 15. [Results](./sub-skills/results.md)
### 16. [Example 3: Image Optimization Strategy](./sub-skills/example-3-image-optimization-strategy.md)
### 17. [Current Issues](./sub-skills/current-issues.md)
### 18. [Optimization Strategy](./sub-skills/optimization-strategy.md)
### 19. [Results](./sub-skills/results.md)
### 20. [✅ Do This](./sub-skills/do-this.md)
### 21. [❌ Don't Do This](./sub-skills/dont-do-this.md)
### 22. [Problem: Optimized for Desktop but Slow on Mobile](./sub-skills/problem-optimized-for-desktop-but-slow-on-mobile.md)
### 23. [Problem: Large JavaScript Bundle](./sub-skills/problem-large-javascript-bundle.md)
### 24. [Problem: Images Causing Layout Shifts](./sub-skills/problem-images-causing-layout-shifts.md)
### 25. [Problem: Slow Server Response Time](./sub-skills/problem-slow-server-response-time.md)
### 26. [Images](./sub-skills/images.md)
### 27. [JavaScript](./sub-skills/javascript.md)
### 28. [CSS](./sub-skills/css.md)
### 29. [Caching](./sub-skills/caching.md)
### 30. [Core Web Vitals](./sub-skills/core-web-vitals.md)
### 31. [Measurement Tools](./sub-skills/measurement-tools.md)
### 32. [Analysis Tools](./sub-skills/analysis-tools.md)
### 33. [Monitoring Tools](./sub-skills/monitoring-tools.md)


<!-- MERGED FROM seo-fundamentals -->

---
name: seo-fundamentals
description: SEO fundamentals, E-E-A-T, Core Web Vitals, and Google algorithm principles.
allowed-tools: Read, Glob, Grep
---

# SEO Fundamentals

> Principles for search engine visibility.

---

## 1. E-E-A-T Framework

| Principle | Signals |
|-----------|---------|
| **Experience** | First-hand knowledge, real examples |
| **Expertise** | Credentials, depth of knowledge |
| **Authoritativeness** | Backlinks, mentions, industry recognition |
| **Trustworthiness** | HTTPS, transparency, accurate info |

---

## 2. Core Web Vitals

| Metric | Target | Measures |
|--------|--------|----------|
| **LCP** | < 2.5s | Loading performance |
| **INP** | < 200ms | Interactivity |
| **CLS** | < 0.1 | Visual stability |

---

## 3. Technical SEO Principles

### Site Structure

| Element | Purpose |
|---------|---------|
| XML sitemap | Help crawling |
| robots.txt | Control access |
| Canonical tags | Prevent duplicates |
| HTTPS | Security signal |

### Performance

| Factor | Impact |
|--------|--------|
| Page speed | Core Web Vital |
| Mobile-friendly | Ranking factor |
| Clean URLs | Crawlability |

---

## 4. Content SEO Principles

### Page Elements

| Element | Best Practice |
|---------|---------------|
| Title tag | 50-60 chars, keyword front |
| Meta description | 150-160 chars, compelling |
| H1 | One per page, main keyword |
| H2-H6 | Logical hierarchy |
| Alt text | Descriptive, not stuffed |

### Content Quality

| Factor | Importance |
|--------|------------|
| Depth | Comprehensive coverage |
| Freshness | Regular updates |
| Uniqueness | Original value |
| Readability | Clear writing |

---

## 5. Schema Markup Types

| Type | Use |
|------|-----|
| Article | Blog posts, news |
| Organization | Company info |
| Person | Author profiles |
| FAQPage | Q&A content |
| Product | E-commerce |
| Review | Ratings |
| BreadcrumbList | Navigation |

---

## 6. AI Content Guidelines

### What Google Looks For

| ✅ Do | ❌ Don't |
|-------|----------|
| AI draft + human edit | Publish raw AI content |
| Add original insights | Copy without value |
| Expert review | Skip fact-checking |
| Follow E-E-A-T | Keyword stuffing |

---

## 7. Ranking Factors (Prioritized)

| Priority | Factor |
|----------|--------|
| 1 | Quality, relevant content |
| 2 | Backlinks from authority sites |
| 3 | Page experience (Core Web Vitals) |
| 4 | Mobile optimization |
| 5 | Technical SEO fundamentals |

---

## 8. Measurement

| Metric | Tool |
|--------|------|
| Rankings | Search Console, Ahrefs |
| Traffic | Analytics |
| Core Web Vitals | PageSpeed Insights |
| Indexing | Search Console |
| Backlinks | Ahrefs, Semrush |

---

> **Remember:** SEO is a long-term game. Quality content + technical excellence + patience = results.


<!-- MERGED FROM geo-fundamentals -->

---
name: geo-fundamentals
description: Generative Engine Optimization for AI search engines (ChatGPT, Claude, Perplexity).
allowed-tools: Read, Glob, Grep
---

# GEO Fundamentals

> Optimization for AI-powered search engines.

---

## 1. What is GEO?

**GEO** = Generative Engine Optimization

| Goal | Platform |
|------|----------|
| Be cited in AI responses | ChatGPT, Claude, Perplexity, Gemini |

### SEO vs GEO

| Aspect | SEO | GEO |
|--------|-----|-----|
| Goal | #1 ranking | AI citations |
| Platform | Google | AI engines |
| Metrics | Rankings, CTR | Citation rate |
| Focus | Keywords | Entities, data |

---

## 2. AI Engine Landscape

| Engine | Citation Style | Opportunity |
|--------|----------------|-------------|
| **Perplexity** | Numbered [1][2] | Highest citation rate |
| **ChatGPT** | Inline/footnotes | Custom GPTs |
| **Claude** | Contextual | Long-form content |
| **Gemini** | Sources section | SEO crossover |

---

## 3. RAG Retrieval Factors

How AI engines select content to cite:

| Factor | Weight |
|--------|--------|
| Semantic relevance | ~40% |
| Keyword match | ~20% |
| Authority signals | ~15% |
| Freshness | ~10% |
| Source diversity | ~15% |

---

## 4. Content That Gets Cited

| Element | Why It Works |
|---------|--------------|
| **Original statistics** | Unique, citable data |
| **Expert quotes** | Authority transfer |
| **Clear definitions** | Easy to extract |
| **Step-by-step guides** | Actionable value |
| **Comparison tables** | Structured info |
| **FAQ sections** | Direct answers |

---

## 5. GEO Content Checklist

### Content Elements

- [ ] Question-based titles
- [ ] Summary/TL;DR at top
- [ ] Original data with sources
- [ ] Expert quotes (name, title)
- [ ] FAQ section (3-5 Q&A)
- [ ] Clear definitions
- [ ] "Last updated" timestamp
- [ ] Author with credentials

### Technical Elements

- [ ] Article schema with dates
- [ ] Person schema for author
- [ ] FAQPage schema
- [ ] Fast loading (< 2.5s)
- [ ] Clean HTML structure

---

## 6. Entity Building

| Action | Purpose |
|--------|---------|
| Google Knowledge Panel | Entity recognition |
| Wikipedia (if notable) | Authority source |
| Consistent info across web | Entity consolidation |
| Industry mentions | Authority signals |

---

## 7. AI Crawler Access

### Key AI User-Agents

| Crawler | Engine |
|---------|--------|
| GPTBot | ChatGPT/OpenAI |
| Claude-Web | Claude |
| PerplexityBot | Perplexity |
| Googlebot | Gemini (shared) |

### Access Decision

| Strategy | When |
|----------|------|
| Allow all | Want AI citations |
| Block GPTBot | Don't want OpenAI training |
| Selective | Allow some, block others |

---

## 8. Measurement

| Metric | How to Track |
|--------|--------------|
| AI citations | Manual monitoring |
| "According to [Brand]" mentions | Search in AI |
| Competitor citations | Compare share |
| AI-referred traffic | UTM parameters |

---

## 9. Anti-Patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| Publish without dates | Add timestamps |
| Vague attributions | Name sources |
| Skip author info | Show credentials |
| Thin content | Comprehensive coverage |

---

> **Remember:** AI cites content that's clear, authoritative, and easy to extract. Be the best answer.

---

## Script

| Script | Purpose | Command |
|--------|---------|---------|
| `scripts/geo_checker.py` | GEO audit (AI citation readiness) | `python scripts/geo_checker.py <project_path>` |


