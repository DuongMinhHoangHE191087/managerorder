---
version: 4.1.0-fractal
name: nodejs-backend-patterns
description: Build production-ready Node.js backend services with Express/Fastify, implementing middleware patterns, error handling, authentication, database integration, and API design best practices. Use when creating Node.js servers, REST APIs, GraphQL backends, or microservices architectures.
---

# Node.js Backend Patterns

Comprehensive guidance for building scalable, maintainable, and production-ready Node.js backend applications with modern frameworks, architectural patterns, and best practices.

## Use this skill when

- Building REST APIs or GraphQL servers
- Creating microservices with Node.js
- Implementing authentication and authorization
- Designing scalable backend architectures
- Setting up middleware and error handling
- Integrating databases (SQL and NoSQL)
- Building real-time applications with WebSockets
- Implementing background job processing

## Do not use this skill when

- The task is unrelated to node.js backend patterns
- You need a different domain or tool outside this scope

## Instructions

- Clarify goals, constraints, and required inputs.
- Apply relevant best practices and validate outcomes.
- Provide actionable steps and verification.
- If detailed examples are required, open `resources/implementation-playbook.md`.

## Resources

- `resources/implementation-playbook.md` for detailed patterns and examples.


## ≡ƒºá Knowledge Modules (Fractal Skills)

### 1. [implementation-playbook](./sub-skills/implementation-playbook.md)


<!-- MERGED FROM backend-dev-guidelines -->

---
version: 4.1.0-fractal
name: backend-dev-guidelines
description: Opinionated backend development standards for Node.js + Express + TypeScript microservices. Covers layered architecture, BaseController pattern, dependency injection, Prisma repositories, Zod validation, unifiedConfig, Sentry error tracking, async safety, and testing discipline.
---

# Backend Development Guidelines

**(Node.js · Express · TypeScript · Microservices)**

You are a **senior backend engineer** operating production-grade services under strict architectural and reliability constraints.

Your goal is to build **predictable, observable, and maintainable backend systems** using:

* Layered architecture
* Explicit error boundaries
* Strong typing and validation
* Centralized configuration
* First-class observability

This skill defines **how backend code must be written**, not merely suggestions.

---

## 1. Backend Feasibility & Risk Index (BFRI)

Before implementing or modifying a backend feature, assess feasibility.

### BFRI Dimensions (1–5)

| Dimension                     | Question                                                         |
| ----------------------------- | ---------------------------------------------------------------- |
| **Architectural Fit**         | Does this follow routes → controllers → services → repositories? |
| **Business Logic Complexity** | How complex is the domain logic?                                 |
| **Data Risk**                 | Does this affect critical data paths or transactions?            |
| **Operational Risk**          | Does this impact auth, billing, messaging, or infra?             |
| **Testability**               | Can this be reliably unit + integration tested?                  |

### Score Formula

```
BFRI = (Architectural Fit + Testability) − (Complexity + Data Risk + Operational Risk)
```

**Range:** `-10 → +10`

### Interpretation

| BFRI     | Meaning   | Action                 |
| -------- | --------- | ---------------------- |
| **6–10** | Safe      | Proceed                |
| **3–5**  | Moderate  | Add tests + monitoring |
| **0–2**  | Risky     | Refactor or isolate    |
| **< 0**  | Dangerous | Redesign before coding |

---

## 2. When to Use This Skill

Automatically applies when working on:

* Routes, controllers, services, repositories
* Express middleware
* Prisma database access
* Zod validation
* Sentry error tracking
* Configuration management
* Backend refactors or migrations

---

## 3. Core Architecture Doctrine (Non-Negotiable)

### 1. Layered Architecture Is Mandatory

```
Routes → Controllers → Services → Repositories → Database
```

* No layer skipping
* No cross-layer leakage
* Each layer has **one responsibility**

---

### 2. Routes Only Route

```ts
// ❌ NEVER
router.post('/create', async (req, res) => {
  await prisma.user.create(...);
});

// ✅ ALWAYS
router.post('/create', (req, res) =>
  userController.create(req, res)
);
```

Routes must contain **zero business logic**.

---

### 3. Controllers Coordinate, Services Decide

* Controllers:

  * Parse request
  * Call services
  * Handle response formatting
  * Handle errors via BaseController

* Services:

  * Contain business rules
  * Are framework-agnostic
  * Use DI
  * Are unit-testable

---

### 4. All Controllers Extend `BaseController`

```ts
export class UserController extends BaseController {
  async getUser(req: Request, res: Response): Promise<void> {
    try {
      const user = await this.userService.getById(req.params.id);
      this.handleSuccess(res, user);
    } catch (error) {
      this.handleError(error, res, 'getUser');
    }
  }
}
```

No raw `res.json` calls outside BaseController helpers.

---

### 5. All Errors Go to Sentry

```ts
catch (error) {
  Sentry.captureException(error);
  throw error;
}
```

❌ `console.log`
❌ silent failures
❌ swallowed errors

---

### 6. unifiedConfig Is the Only Config Source

```ts
// ❌ NEVER
process.env.JWT_SECRET;

// ✅ ALWAYS
import { config } from '@/config/unifiedConfig';
config.auth.jwtSecret;
```

---

### 7. Validate All External Input with Zod

* Request bodies
* Query params
* Route params
* Webhook payloads

```ts
const schema = z.object({
  email: z.string().email(),
});

const input = schema.parse(req.body);
```

No validation = bug.

---

## 4. Directory Structure (Canonical)

```
src/
├── config/              # unifiedConfig
├── controllers/         # BaseController + controllers
├── services/            # Business logic
├── repositories/        # Prisma access
├── routes/              # Express routes
├── middleware/          # Auth, validation, errors
├── validators/          # Zod schemas
├── types/               # Shared types
├── utils/               # Helpers
├── tests/               # Unit + integration tests
├── instrument.ts        # Sentry (FIRST IMPORT)
├── app.ts               # Express app
└── server.ts            # HTTP server
```

---

## 5. Naming Conventions (Strict)

| Layer      | Convention                |
| ---------- | ------------------------- |
| Controller | `PascalCaseController.ts` |
| Service    | `camelCaseService.ts`     |
| Repository | `PascalCaseRepository.ts` |
| Routes     | `camelCaseRoutes.ts`      |
| Validators | `camelCase.schema.ts`     |

---

## 6. Dependency Injection Rules

* Services receive dependencies via constructor
* No importing repositories directly inside controllers
* Enables mocking and testing

```ts
export class UserService {
  constructor(
    private readonly userRepository: UserRepository
  ) {}
}
```

---

## 7. Prisma & Repository Rules

* Prisma client **never used directly in controllers**
* Repositories:

  * Encapsulate queries
  * Handle transactions
  * Expose intent-based methods

```ts
await userRepository.findActiveUsers();
```

---

## 8. Async & Error Handling

### asyncErrorWrapper Required

All async route handlers must be wrapped.

```ts
router.get(
  '/users',
  asyncErrorWrapper((req, res) =>
    controller.list(req, res)
  )
);
```

No unhandled promise rejections.

---

## 9. Observability & Monitoring

### Required

* Sentry error tracking
* Sentry performance tracing
* Structured logs (where applicable)

Every critical path must be observable.

---

## 10. Testing Discipline

### Required Tests

* **Unit tests** for services
* **Integration tests** for routes
* **Repository tests** for complex queries

```ts
describe('UserService', () => {
  it('creates a user', async () => {
    expect(user).toBeDefined();
  });
});
```

No tests → no merge.

---

## 11. Anti-Patterns (Immediate Rejection)

❌ Business logic in routes
❌ Skipping service layer
❌ Direct Prisma in controllers
❌ Missing validation
❌ process.env usage
❌ console.log instead of Sentry
❌ Untested business logic

---

## 12. Integration With Other Skills

* **frontend-dev-guidelines** → API contract alignment
* **error-tracking** → Sentry standards
* **database-verification** → Schema correctness
* **analytics-tracking** → Event pipelines
* **skill-developer** → Skill governance

---

## 13. Operator Validation Checklist

Before finalizing backend work:

* [ ] BFRI ≥ 3
* [ ] Layered architecture respected
* [ ] Input validated
* [ ] Errors captured in Sentry
* [ ] unifiedConfig used
* [ ] Tests written
* [ ] No anti-patterns present

---

## 14. Skill Status

**Status:** Stable · Enforceable · Production-grade
**Intended Use:** Long-lived Node.js microservices with real traffic and real risk
---


## 🧠 Knowledge Modules (Fractal Skills)

### 1. [architecture-overview](./sub-skills/architecture-overview.md)
### 2. [async-and-errors](./sub-skills/async-and-errors.md)
### 3. [complete-examples](./sub-skills/complete-examples.md)
### 4. [configuration](./sub-skills/configuration.md)
### 5. [database-patterns](./sub-skills/database-patterns.md)
### 6. [middleware-guide](./sub-skills/middleware-guide.md)
### 7. [routing-and-controllers](./sub-skills/routing-and-controllers.md)
### 8. [sentry-and-monitoring](./sub-skills/sentry-and-monitoring.md)
### 9. [services-and-repositories](./sub-skills/services-and-repositories.md)
### 10. [testing-guide](./sub-skills/testing-guide.md)
### 11. [validation-patterns](./sub-skills/validation-patterns.md)


<!-- MERGED FROM api-patterns -->

---
name: api-patterns
description: API design principles and decision-making.
category: architecture
version: 4.1.0-fractal
layer: master-skill
---

# API Patterns

> API design principles and decision-making for 2025.
> **Learn to THINK, not copy fixed patterns.**

## 🎯 Selective Reading Rule

**Read ONLY files relevant to the request!** Check the content map, find what you need.

---

## 📑 Content Map

| File | Description | When to Read |
|------|-------------|--------------|
| `api-style.md` | REST vs GraphQL vs tRPC decision tree | Choosing API type |
| `rest.md` | Resource naming, HTTP methods, status codes | Designing REST API |
| `response.md` | Envelope pattern, error format, pagination | Response structure |
| `graphql.md` | Schema design, when to use, security | Considering GraphQL |
| `trpc.md` | TypeScript monorepo, type safety | TS fullstack projects |
| `versioning.md` | URI/Header/Query versioning | API evolution planning |
| `auth.md` | JWT, OAuth, Passkey, API Keys | Auth pattern selection |
| `rate-limiting.md` | Token bucket, sliding window | API protection |
| `documentation.md` | OpenAPI/Swagger best practices | Documentation |
| `security-testing.md` | OWASP API Top 10, auth/authz testing | Security audits |

---

## 🔗 Related Skills

| Need | Skill |
|------|-------|
| API implementation | `@[skills/backend-development]` |
| Data structure | `@[skills/database-design]` |
| Security details | `@[skills/security-hardening]` |

---

## ✅ Decision Checklist

Before designing an API:

- [ ] **Asked user about API consumers?**
- [ ] **Chosen API style for THIS context?** (REST/GraphQL/tRPC)
- [ ] **Defined consistent response format?**
- [ ] **Planned versioning strategy?**
- [ ] **Considered authentication needs?**
- [ ] **Planned rate limiting?**
- [ ] **Documentation approach defined?**

---

## ❌ Anti-Patterns

**DON'T:**
- Default to REST for everything
- Use verbs in REST endpoints (/getUsers)
- Return inconsistent response formats
- Expose internal errors to clients
- Skip rate limiting

**DO:**
- Choose API style based on context
- Ask about client requirements
- Document thoroughly
- Use appropriate status codes

---

## Script

| Script | Purpose | Command |
|--------|---------|---------|
| `scripts/api_validator.py` | API endpoint validation | `python scripts/api_validator.py <project_path>` |


