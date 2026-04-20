<!--
  Sync Impact Report
  ─────────────────────────────────────────────────────
  Version change: 0.0.0 (template) → 1.0.0
  Modified principles: N/A (initial creation)
  Added sections:
    - Core Principles (7 principles)
    - Technology Constraints
    - Development Workflow
    - Governance
  Removed sections: N/A
  Templates requiring updates:
    ✅ plan-template.md — Constitution Check placeholder compatible
    ✅ spec-template.md — Functional requirements align with principles
    ✅ tasks-template.md — Phase structure and task types compatible
  Follow-up TODOs: None
  ─────────────────────────────────────────────────────
-->

# Chef Book Constitution

## Core Principles

### I. Vanilla-First Frontend

All frontend code MUST be authored in plain HTML5, Vanilla CSS3, and
ES6+ JavaScript modules. No frontend frameworks (React, Vue, Angular)
are permitted. Third-party libraries are allowed ONLY when they provide
functionality impractical to hand-code (e.g., `jspdf` for PDF
generation, `boxicons` for icon sets). Every new library addition MUST
be justified in the PR description with a rationale explaining why a
vanilla implementation is insufficient.

**Rationale**: Keeps the bundle minimal, avoids framework churn, and
ensures full control over the UI — critical for a PWA that targets
both desktop and mobile via Capacitor.

### II. Express REST API

The backend MUST expose all functionality through a RESTful JSON API
served by Express.js on Node.js. Route files MUST live under
`server/routes/` and follow the existing naming convention
(`auth.js`, `recipes.js`, `admin.js`, etc.). Every route file MUST
use ES module `import`/`export` syntax. New endpoints MUST be
documented in `server/README.md` before the PR is merged.

**Rationale**: A single, consistent API surface simplifies the
frontend–backend contract and keeps the codebase navigable as
feature count grows.

### III. PostgreSQL Data Integrity

PostgreSQL is the ONLY supported relational store. All schema changes
MUST be expressed as idempotent SQL (`CREATE TABLE IF NOT EXISTS`,
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) inside
`server/database/init_pg.js` or a dedicated migration script. Every
table that references another MUST declare explicit foreign keys with
appropriate `ON DELETE` behaviour. Queries MUST use parameterised
placeholders (`$1`, `$2`, …) — string concatenation of user input
into SQL is NEVER permitted.

**Rationale**: Referential integrity and parameterised queries are
the two most effective defences against data corruption and SQL
injection, respectively.

### IV. JWT Authentication & Authorization

User identity MUST be verified via JWT bearer tokens issued by
`server/middleware/auth.js`. Tokens MUST expire within 24 hours;
refresh tokens MUST expire within 7 days. Every mutation endpoint
(POST/PUT/PATCH/DELETE) MUST require `authenticateToken` unless
the endpoint is explicitly public (e.g., `/api/auth/register`,
`/api/auth/login`, `/api/recipes/public`). Admin-only endpoints
MUST additionally pass through `requireAdmin`. Premium-gated
endpoints MUST use `requirePremium`.

**Rationale**: A layered middleware chain (auth → role → premium)
keeps access control declarative and auditable at the route level.

### V. Premium Monetization Parity

All monetisation paths — Stripe checkout, wallet balance, and
admin-granted subscriptions — MUST converge on the same subscription
and transaction records in PostgreSQL. A purchase through any channel
MUST create a row in `transactions` and update `subscriptions`. The
frontend MUST verify premium status from the server on each
protected action; client-side caching of premium state MUST NOT
be used as the sole gate.

**Rationale**: A single source of truth for subscription state
prevents revenue leakage and ensures consistent user experience
regardless of payment method.

### VI. PWA & Mobile Readiness

The application MUST remain installable as a Progressive Web App and
buildable as a native Android app via Capacitor. The Vite PWA plugin
MUST stay configured with `registerType: 'autoUpdate'`. All user-
facing pages MUST be responsive down to 360 px viewport width. New
pages MUST include appropriate `<meta>` tags for SEO and mobile
viewport. Assets referenced in the PWA manifest (`pwa-192x192.png`,
`pwa-512x512.png`) MUST NOT be removed or renamed without updating
`vite.config.js`.

**Rationale**: Chef Book's value proposition includes "native-like"
mobile access; breaking PWA or Capacitor compatibility directly
harms the user base.

### VII. Performance & Security Hardening

Rate limiting MUST be active on all `/api/` routes (general limiter)
and stricter on `/api/auth` routes. Passwords MUST be hashed with
`bcryptjs` (minimum 10 salt rounds). CORS MUST be configured to
allow only the frontend origin defined in `FRONTEND_URL`. Sensitive
configuration (JWT secret, database URL, Stripe keys) MUST reside
exclusively in `.env` and MUST NOT be committed to version control.
Database queries MUST avoid N+1 patterns; consolidated queries with
JOINs and aggregation functions MUST be preferred.

**Rationale**: Security and performance are non-negotiable for an
application that handles user credentials and financial transactions.

## Technology Constraints

- **Frontend build**: Vite 6.x with `vite-plugin-pwa`
- **Backend runtime**: Node.js 18+ with ES modules (`"type": "module"`)
- **Database**: PostgreSQL via `pg` driver (connection pooling required)
- **Payments**: Stripe SDK (`stripe` npm package)
- **Authentication**: `jsonwebtoken` + `bcryptjs`
- **File uploads**: `multer` (server-side)
- **Mobile wrapper**: Capacitor 8.x (Android)
- **Dev tooling**: `nodemon` (server), `concurrently` (parallel dev),
  `vitest` + `supertest` (testing)
- **Deployment target**: Any platform supporting Node.js 18+ and
  PostgreSQL 14+ (e.g., Railway, Render, Fly.io, VPS)

Adding a new runtime dependency MUST be approved via PR review and
documented in the relevant `package.json`. Dev-only dependencies
MUST be placed in `devDependencies`.

## Development Workflow

1. **Branch from `main`**: Every feature or fix MUST be developed on a
   dedicated branch. Branch names SHOULD follow `<type>/<short-desc>`
   (e.g., `feat/wallet-topup`, `fix/recipe-n-plus-one`).
2. **Run locally**: Use `npm run dev` at the project root. This starts
   the Vite dev server (port 5173) and the Express API (port 3001)
   concurrently. The Vite proxy forwards `/api` requests to the
   backend.
3. **Test before committing**: Run `npm test` (vitest) for unit/
   integration tests. Manual smoke-test the affected user flow in the
   browser.
4. **Commit messages**: Follow Conventional Commits format
   (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `perf:`).
5. **Code review**: Every PR MUST be reviewed against the constitution
   principles before merge. The Constitution Check section in
   `plan-template.md` MUST be completed for planned features.
6. **Database changes**: Schema migrations MUST be tested locally with
   `npm run init-db` before pushing. Destructive migrations (column
   drops, table drops) MUST include a rollback plan.

## Governance

- This constitution is the highest-authority document for the Chef Book
  project. It supersedes ad-hoc decisions, verbal agreements, and
  contradictory comments in code.
- **Amendments**: Any change to this constitution MUST be proposed as a
  PR, reviewed by at least one maintainer, and documented with a
  version bump following semantic versioning (MAJOR for principle
  removals/redefinitions, MINOR for additions, PATCH for clarifications).
- **Compliance review**: At the start of every planned feature
  (`/speckit.plan`), the Constitution Check section MUST be filled out,
  verifying alignment with all active principles.
- **Violation handling**: If a principle is intentionally violated, it
  MUST be documented in the Complexity Tracking table of the plan with
  a justification and a note of which simpler alternative was rejected
  and why.
- **Runtime guidance**: Refer to `AGENTS.md` and `server/README.md` for
  day-to-day development instructions.

**Version**: 1.0.0 | **Ratified**: 2026-04-20 | **Last Amended**: 2026-04-20
