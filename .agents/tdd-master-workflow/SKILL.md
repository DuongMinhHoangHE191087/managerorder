---
name: tdd-master-workflow
description: >
  Comprehensive Test-Driven Development (TDD) cycle. Enforces strict Red-Green-Refactor 
  discipline, test architecture design, and multi-agent testing coordination.
---

# 🧪 TDD Master Workflow

You are an **Expert TDD Practitioner**. Your core mission is to ensure code correctness and maintainability by writing tests **before** implementation.

---

## 📑 The Red-Green-Refactor Cycle

### 🔴 Phase 1: RED (Write a Failing Test)
- **Objective**: Define expected behavior via a test that fails.
- **Action**: Write the simplest possible test for a new bit of functionality.
- **Verification**: Run the test and confirm it fails for the **correct reason** (missing logic, not syntax error).

### 🟢 Phase 2: GREEN (Make the Test Pass)
- **Objective**: Implement only enough code to satisfy the test.
- **Action**: Write "quick and dirty" code if necessary. Avoid over-engineering.
- **Verification**: Run the test suite and confirm it passes.

### 🔵 Phase 3: REFACTOR (Improve the Code)
- **Objective**: Clean up the code while keeping the tests green.
- **Action**: 
  - Remove duplication (DRY).
  - Improve naming and readability.
  - Simplify logic.
- **Verification**: Run tests after every small refactor to ensure no regressions.

---

## 🏗️ Test Architecture & Standards

- **Isolation**: Each test must be independent. Use mocks/stubs for external dependencies (DB, API).
- **Speed**: Unit tests should run in < 5 seconds.
- **Coverage**: 
  - 100% on critical business logic.
  - > 80% overall line coverage.
- **Naming**: `should_[expected_behavior]_when_[condition]`.

---

## 🛠️ Execution Protocol

1. **Requirements Analysis**: Define acceptance criteria.
2. **Write RED Test**: Create the failing test case first.
3. **Write GREEN Code**: Implement minimal logic.
4. **REFACTOR**: Polish code and tests.
5. **Continuous Loop**: Repeat for every atomic task.

---
*Merged and optimized from 7 legacy TDD and testing skills.*


<!-- MERGED FROM webapp-testing -->

---
name: webapp-testing
description: Web application testing principles. E2E, Playwright, deep audit strategies.
category: security
version: 4.1.0-fractal
layer: master-skill
---

# Web App Testing

> Discover and test everything. Leave no route untested.

## 🔧 Runtime Scripts

**Execute these for automated browser testing:**

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/playwright_runner.py` | Basic browser test | `python scripts/playwright_runner.py https://example.com` |
| | With screenshot | `python scripts/playwright_runner.py <url> --screenshot` |
| | Accessibility check | `python scripts/playwright_runner.py <url> --a11y` |

**Requires:** `pip install playwright && playwright install chromium`

---

## 1. Deep Audit Approach

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [Discovery First](./sub-skills/discovery-first.md)
### 2. [Systematic Testing](./sub-skills/systematic-testing.md)
### 3. [What to Test](./sub-skills/what-to-test.md)
### 4. [E2E Best Practices](./sub-skills/e2e-best-practices.md)
### 5. [Core Concepts](./sub-skills/core-concepts.md)
### 6. [Configuration](./sub-skills/configuration.md)
### 7. [When to Use](./sub-skills/when-to-use.md)
### 8. [Strategy](./sub-skills/strategy.md)
### 9. [Coverage Areas](./sub-skills/coverage-areas.md)
### 10. [File Structure](./sub-skills/file-structure.md)
### 11. [Naming Convention](./sub-skills/naming-convention.md)
### 12. [Pipeline Steps](./sub-skills/pipeline-steps.md)
### 13. [Parallelization](./sub-skills/parallelization.md)


<!-- MERGED FROM systematic-debugging -->

---
name: systematic-debugging
description: 4-phase systematic debugging methodology with root cause analysis and evidence-based verification.
category: tools
version: 4.1.0-fractal
layer: master-skill
---

# Systematic Debugging

> Source: obra/superpowers

## Overview
This skill provides a structured approach to debugging that prevents random guessing and ensures problems are properly understood before solving.

## 4-Phase Debugging Process

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [Phase 1: Reproduce](./sub-skills/phase-1-reproduce.md)
### 2. [Phase 2: Isolate](./sub-skills/phase-2-isolate.md)
### 3. [Phase 3: Understand](./sub-skills/phase-3-understand.md)
### 4. [The 5 Whys](./sub-skills/the-5-whys.md)
### 5. [Phase 4: Fix & Verify](./sub-skills/phase-4-fix-verify.md)

