# CLAUDE.md — TeamWiki

This file governs how Claude Code assists on this project. Read it in full before taking any action. These rules are non-negotiable; do not deviate without explicit user approval.

---

## 1. Project Overview

**TeamWiki** is a production-grade internal knowledge base for company teams. It provides structured article management, collaborative editing, role-based access control, and document import capabilities.

**Core capabilities:**
- Full-text article search (PostgreSQL `tsvector`)
- Markdown editor with live preview
- Article version history with revision diff viewer
- Tag and category management
- Role-based permissions (Admin, Editor, Viewer)
- Admin panel for user management
- Filesystem MCP document import pipeline

**Runtime targets:**
- Node.js 20 LTS
- PostgreSQL 16
- Next.js 15 App Router (React Server Components by default)

---

## 2. Architecture Overview

```
Browser
  └── Next.js 15 App Router (RSC-first)
        ├── Server Components  — data fetching, layout, access checks
        ├── Client Components  — interactive UI only (editor, search, diff viewer)
        └── Route Handlers     — REST API surface (/api/*)
              └── Service Layer
                    └── Prisma ORM
                          └── PostgreSQL 16
```

**Auth:** NextAuth/Auth.js v5 with database sessions stored in PostgreSQL.

**Search:** PostgreSQL full-text search via `tsvector` columns updated by Prisma triggers. No external search service.

**File imports:** MCP Filesystem server reads documents from a designated import directory and maps them to the Prisma article model. MCP is a background integration only — it never bypasses auth or business logic.

**Key architectural rules:**
- Data fetching happens in Server Components or Route Handlers — never in Client Components directly.
- Client Components are leaf nodes: they receive data as props or call Route Handlers.
- Business logic lives in `/src/lib/services/` — never inline in components or Route Handlers.
- Route Handlers call service functions; they do not contain business logic themselves.
- All database access goes through Prisma. Raw SQL is forbidden except for performance-critical full-text search queries, which must be isolated in `/src/lib/db/search.ts`.

---

## 3. Folder Structure

```
teamwiki/
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Lint, type-check, unit, integration tests
│       └── e2e.yml                 # Playwright tests on preview deploys
├── prisma/
│   ├── schema.prisma
│   ├── migrations/                 # Never edit manually
│   └── seed.ts
├── public/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/                 # Auth group: login, register
│   │   ├── (dashboard)/            # Protected group: all app routes
│   │   │   ├── articles/
│   │   │   │   ├── [slug]/
│   │   │   │   │   ├── page.tsx    # Server Component — article view
│   │   │   │   │   ├── edit/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── history/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── new/
│   │   │   │   └── page.tsx        # Article list
│   │   │   ├── admin/
│   │   │   │   ├── users/
│   │   │   │   └── page.tsx
│   │   │   ├── search/
│   │   │   └── tags/
│   │   ├── api/
│   │   │   ├── articles/
│   │   │   ├── auth/               # NextAuth route handler
│   │   │   ├── search/
│   │   │   ├── tags/
│   │   │   └── users/
│   │   ├── layout.tsx
│   │   └── not-found.tsx
│   ├── components/
│   │   ├── ui/                     # Headless/primitive components (no business logic)
│   │   ├── articles/               # Article-domain components
│   │   ├── editor/                 # Markdown editor (Client Component)
│   │   ├── diff/                   # Revision diff viewer (Client Component)
│   │   ├── search/                 # Search UI (Client Component)
│   │   └── admin/                  # Admin-only components
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── config.ts           # NextAuth configuration
│   │   │   └── permissions.ts      # Role/permission helpers
│   │   ├── db/
│   │   │   ├── client.ts           # Prisma client singleton
│   │   │   └── search.ts           # Full-text search queries (raw SQL only here)
│   │   ├── services/               # All business logic
│   │   │   ├── articles.ts
│   │   │   ├── revisions.ts
│   │   │   ├── search.ts
│   │   │   ├── tags.ts
│   │   │   └── users.ts
│   │   ├── mcp/
│   │   │   ├── client.ts           # MCP filesystem client
│   │   │   └── importer.ts         # Import pipeline logic
│   │   ├── validations/            # Zod schemas (one file per domain)
│   │   │   ├── article.ts
│   │   │   ├── user.ts
│   │   │   └── tag.ts
│   │   └── utils/
│   │       ├── markdown.ts
│   │       └── slugify.ts
│   ├── hooks/                      # Client-side React hooks
│   ├── types/                      # Global TypeScript types
│   │   └── index.ts
│   └── middleware.ts               # Auth + RBAC middleware
├── tests/
│   ├── unit/                       # Jest unit tests
│   ├── integration/                # Jest integration tests (real DB)
│   └── e2e/                        # Playwright end-to-end tests
├── .env.example
├── .eslintrc.json
├── .prettierrc
├── jest.config.ts
├── playwright.config.ts
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── CLAUDE.md
```

---

## 4. Coding Standards

### TypeScript

- `strict: true` is mandatory. Never use `any` or `@ts-ignore`. Use `unknown` and narrow explicitly.
- All exported functions must have explicit return type annotations.
- Use `type` for pure shape definitions. Use `interface` only when declaration merging is required.
- Prefer `const` over `let`. Never use `var`.
- Avoid non-null assertions (`!`). Use optional chaining and guard clauses instead.
- Zod schemas are the single source of truth for runtime validation. Infer TypeScript types from them: `type ArticleInput = z.infer<typeof articleSchema>`.

### React / Next.js

- Default to Server Components. Add `'use client'` only when the component requires browser APIs, event handlers, or React state/effects.
- Never call `cookies()`, `headers()`, or `getServerSession()` inside Client Components.
- Route Handlers must validate all input with Zod before passing to services.
- Use `next/image` for all images. Never use raw `<img>` tags.
- Use `next/link` for all internal navigation. Never use raw `<a>` tags for internal routes.
- Streaming is preferred for article pages: wrap slow data in `<Suspense>` with a skeleton fallback.
- Error boundaries are required at the route segment level (`error.tsx`).

### Prisma

- Never call `prisma.$connect()` or `prisma.$disconnect()` manually. The singleton client manages this.
- Always use transactions for multi-table writes: `prisma.$transaction([...])`.
- Include `select` or `include` clauses explicitly — never return entire model objects to the client.
- Migrations are generated by `prisma migrate dev` — never written by hand.
- Seed data lives exclusively in `prisma/seed.ts`.

### Styling

- Tailwind utility classes only. No external CSS files, no inline `style` props, no CSS Modules.
- Class names must be ordered: layout → box model → typography → color → interactivity → responsive/state variants. Use the Prettier Tailwind plugin to enforce this automatically.
- Design tokens (colors, spacing, font sizes) are defined in `tailwind.config.ts` under `theme.extend` — never hardcode hex values or pixel values.
- Dark mode is supported via the `dark:` variant. Every new component must include dark mode styles.

### Error Handling

- Services throw typed error classes defined in `/src/lib/errors.ts` (e.g., `NotFoundError`, `ForbiddenError`, `ValidationError`).
- Route Handlers catch these typed errors and map them to appropriate HTTP status codes.
- Never expose stack traces or internal error details to the client.
- All errors are logged via the structured logger at `/src/lib/logger.ts` (JSON format, severity levels).

---

## 5. Naming Conventions

| Artifact | Convention | Example |
|---|---|---|
| Files (components) | PascalCase | `ArticleCard.tsx` |
| Files (non-components) | camelCase | `articleService.ts` |
| React components | PascalCase | `ArticleCard` |
| Functions | camelCase | `getArticleBySlug` |
| Variables, props | camelCase | `isLoading`, `articleId` |
| Constants (module-level) | SCREAMING_SNAKE_CASE | `MAX_REVISION_DEPTH` |
| TypeScript types | PascalCase | `ArticleWithAuthor` |
| Zod schemas | camelCase with `Schema` suffix | `articleSchema`, `createUserSchema` |
| Database tables | snake_case (Prisma maps) | `articles`, `article_revisions` |
| Database columns | snake_case | `created_at`, `author_id` |
| API routes | kebab-case | `/api/articles/[slug]/revisions` |
| CSS classes | Tailwind utilities only — no custom class names |
| Git branches | `type/short-description` | `feat/revision-diff-viewer` |
| Environment variables | SCREAMING_SNAKE_CASE | `DATABASE_URL`, `NEXTAUTH_SECRET` |

**Prohibited patterns:**
- No `index.ts` barrel files that re-export everything — they cause circular dependency issues and slow type-checking. Import directly from the source file.
- No abbreviations in names unless universally understood (`url`, `id`, `db`, `ctx`).
- No `Util`, `Helper`, `Manager`, `Handler` suffixes on service files — name by domain, not by role.

---

## 6. Git Workflow

### Branch Strategy

- `main` — production. Protected. Requires PR + 1 approval + passing CI.
- `feat/*` — new features
- `fix/*` — bug fixes
- `chore/*` — dependency updates, config, tooling
- `docs/*` — documentation only
- `test/*` — test additions or fixes
- `refactor/*` — refactoring (no behavior change)

Branch from `main`. Open PRs targeting `main`.

### Commit Messages

Follow Conventional Commits strictly:

```
<type>(<scope>): <imperative summary under 72 chars>

[optional body — explain WHY, not what]

[optional footer: BREAKING CHANGE: ..., Closes #<issue>]
```

**Types:** `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`

**Scopes:** `articles`, `revisions`, `search`, `auth`, `admin`, `tags`, `mcp`, `db`, `ui`, `deps`

**Rules:**
- Summary is imperative mood: "add revision diff viewer" not "added" or "adds".
- No period at end of summary line.
- Body explains motivation and trade-offs, not the diff itself.
- Breaking changes require a `BREAKING CHANGE:` footer and a `!` after the type: `feat(auth)!: replace JWT sessions with database sessions`.

### Pull Requests

- Every PR must reference an issue: `Closes #<N>` in the description.
- PR descriptions must include: Summary, What changed, How to test, Screenshots (for UI changes).
- Self-review the diff before requesting review.
- Squash-merge to `main` to keep linear history. Merge commits are forbidden.
- Delete branches after merge.

---

## 7. Testing Strategy

### Layers

| Layer | Tool | Location | What it tests |
|---|---|---|---|
| Unit | Jest + RTL | `tests/unit/` | Pure functions, service logic (mocked DB), React components in isolation |
| Integration | Jest | `tests/integration/` | Service functions against a real test PostgreSQL database |
| End-to-end | Playwright | `tests/e2e/` | Full user flows in a real browser against a seeded test environment |

### Rules

**Unit tests:**
- Co-located `*.test.ts` files are forbidden. All tests live under `tests/`.
- Test file mirrors the source path: `src/lib/services/articles.ts` → `tests/unit/lib/services/articles.test.ts`.
- Mock Prisma using `jest-mock-extended` — never use `prisma.$mock` hacks.
- 100% branch coverage is required for all service functions and Zod validation schemas.
- Use `describe` blocks to group by function. Use `it` (not `test`) with a sentence that reads naturally.

**Integration tests:**
- Use a dedicated `teamwiki_test` PostgreSQL database. The connection string is set via `DATABASE_URL_TEST`.
- Each test file wraps its tests in a `beforeEach` that resets the database using `prisma.truncate` via a helper at `tests/integration/helpers/db.ts`.
- Never share state between integration test files.
- Integration tests must not make network calls (no external APIs, no MCP server calls).

**End-to-end tests:**
- Playwright tests run against a locally seeded environment using `playwright.config.ts` `webServer` option.
- Each test must be fully independent: use `test.beforeEach` to seed required data and `test.afterEach` to clean up.
- Use `data-testid` attributes for all interactive elements targeted by Playwright. Never target by CSS class or text content that may change.
- Never use `page.waitForTimeout()`. Use `page.waitForSelector()` or `expect(locator).toBeVisible()` with retry logic.

### Coverage Thresholds (enforced in CI)

```
Statements:  90%
Branches:    90%
Functions:   90%
Lines:       90%
```

---

## 8. Security Standards

### Authentication & Sessions

- All protected routes are enforced in `src/middleware.ts` using NextAuth session checks. Never rely solely on UI-level hiding.
- Sessions are database-backed. JWT sessions are not permitted in production.
- `NEXTAUTH_SECRET` must be a 64-character random hex string. Rotate every 90 days.
- Session expiry: 8 hours for regular users, 2 hours for admin sessions.

### Authorization (RBAC)

Roles and their permissions:

| Role | Read | Create | Edit Own | Edit Any | Delete | Admin Panel |
|---|---|---|---|---|---|---|
| Viewer | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Editor | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

- Permission checks happen in the service layer (`src/lib/auth/permissions.ts`), not in Route Handlers or components. Services must receive the current user's session as an explicit argument — never call `getServerSession()` inside a service.
- Admin routes must check `session.user.role === 'ADMIN'` at both the middleware level and the service level (defense in depth).

### Input Validation

- Every Route Handler validates request bodies with Zod before any other processing.
- Path parameters (slugs, IDs) are validated and sanitized before database queries.
- Never pass user-controlled strings to raw SQL. Use parameterized queries exclusively.
- File imports via MCP must validate MIME type, file size (max 10 MB), and extension whitelist before processing.

### Output Encoding

- Never use `dangerouslySetInnerHTML`. The Markdown renderer uses a sanitization pipeline (`rehype-sanitize`) before rendering.
- API responses never include password hashes, session tokens, or internal IDs beyond what the client needs.

### HTTP Security Headers

Set via `next.config.ts` `headers()`:

```
Content-Security-Policy     (strict; no unsafe-inline for scripts)
Strict-Transport-Security   max-age=63072000; includeSubDomains; preload
X-Content-Type-Options      nosniff
X-Frame-Options             DENY
Referrer-Policy             strict-origin-when-cross-origin
Permissions-Policy          camera=(), microphone=(), geolocation=()
```

### Environment Variables

- `.env` is gitignored. `.env.example` documents every required variable with a placeholder value, never a real value.
- Secrets are never logged. The structured logger must redact any field named `password`, `token`, `secret`, or `key`.
- Never access `process.env` directly in application code outside of `/src/lib/config.ts`, which validates all env vars at startup using Zod.

### Dependency Security

- `npm audit` runs in CI. Any HIGH or CRITICAL vulnerability blocks the build.
- Dependencies are pinned to exact versions in `package.json`. No `^` or `~` ranges.
- Dependabot is configured for weekly dependency updates via `.github/dependabot.yml`.

---

## 9. MCP Usage Rules

The MCP Filesystem server is used exclusively for the document import pipeline. These rules govern all MCP interactions.

### What MCP Is Allowed To Do

- Read files from the designated import directory (`IMPORT_DIR` env var).
- Report file metadata (name, size, last modified).
- Pass raw file content to the import pipeline in `src/lib/mcp/importer.ts`.

### What MCP Is Never Allowed To Do

- Write to the filesystem.
- Access directories outside `IMPORT_DIR`.
- Bypass authentication or call service functions directly.
- Trigger database writes directly — it must hand off to the import service.
- Be called from client-side code or Route Handlers. The import pipeline is a server-only background process.

### Import Pipeline Rules

1. MCP reads the file; the importer validates MIME type, extension, and size.
2. The importer calls `articlesService.createFromImport()` with the validated content and a system service account identity — not the current user.
3. The import service records an audit log entry including file name, size, timestamp, and the system account ID.
4. If import fails, the error is logged and the file is moved to a `failed/` subdirectory inside `IMPORT_DIR`. The original file is never deleted on failure.
5. Imported articles are created in `DRAFT` status and must be reviewed by an Editor or Admin before publishing.

### MCP Configuration

- MCP server configuration lives in `.mcp.json` at the project root (gitignored).
- `.mcp.json.example` documents the structure without real paths.
- The MCP client is initialized once at server startup in `src/lib/mcp/client.ts` — never instantiated per-request.

---

## 10. CI/CD Standards

### Pipeline Overview

**`ci.yml`** — runs on every push to any branch and every PR:

```
1. Install dependencies (npm ci)
2. Type-check (tsc --noEmit)
3. Lint (eslint)
4. Format check (prettier --check)
5. Unit tests (jest --coverage)
6. Integration tests (jest --config jest.integration.config.ts)
7. Build (next build)
```

All steps must pass. Any failure blocks merge.

**`e2e.yml`** — runs on PR and on merge to `main`:

```
1. Deploy to preview environment
2. Run Playwright tests against preview URL
3. Report results as PR check
```

### Rules

- CI must complete in under 10 minutes. If it exceeds this, investigate parallelization before increasing the limit.
- Never skip CI steps with `[skip ci]` except for documentation-only commits (enforced by path filter in `ci.yml`).
- Environment secrets are stored in GitHub Actions secrets, never in workflow files.
- The build artifact is deterministic: the same source code always produces the same output. No timestamp-based cache busting.
- Database migrations run automatically in the staging environment on merge to `main`. Production migrations require a manual approval step in the workflow.

### Environment Promotion

```
feature branch → PR → CI passes → merge to main → auto-deploy to staging → manual approval → deploy to production
```

- Production deploys happen only from `main`.
- Every production deploy creates a GitHub Release with an auto-generated changelog.
- Rollback is performed by reverting the merge commit and re-deploying — not by force-pushing.

---

## 11. Scope Boundaries

### What Claude Code Must Not Do Without Explicit User Approval

- Modify `prisma/migrations/` — run `prisma migrate dev` instead and let Prisma generate it.
- Modify `.github/workflows/` — CI/CD changes require user review.
- Change any role permission mapping in `src/lib/auth/permissions.ts`.
- Add, remove, or upgrade npm dependencies.
- Create new environment variables without also updating `.env.example` and `src/lib/config.ts`.
- Write or modify seed data in `prisma/seed.ts`.
- Change HTTP security headers in `next.config.ts`.
- Implement any form of caching that persists across requests (e.g., Redis, in-memory store) — this must be architecturally approved.
- Push to `main` or any protected branch.
- Delete any file that has git history without confirming it is truly unused.

### What Claude Code Can Do Freely

- Edit and create files in `src/`, `tests/`, `public/`.
- Run read-only commands: `tsc --noEmit`, `eslint`, `prettier --check`, `jest`, `prisma validate`, `git status`, `git log`, `git diff`.
- Scaffold new components, services, route handlers, and Zod schemas following the conventions in this file.
- Read any file in the repository.

### Explicitly Out of Scope for This Project

- Real-time collaboration (WebSockets, CRDTs) — not in scope.
- Email notifications — not in scope.
- External search engines (Elasticsearch, Algolia) — PostgreSQL FTS is the solution.
- Multi-tenancy — single-tenant only.
- Mobile apps — web only.
- AI-generated article suggestions — not in scope.
- S3 or external storage — local filesystem for imports only.

---

## 12. Definition of Done

A task is complete only when **all** of the following are true:

### Code Quality
- [ ] TypeScript compiles with no errors (`tsc --noEmit`)
- [ ] ESLint reports zero warnings or errors
- [ ] Prettier reports no formatting issues
- [ ] No `any`, `@ts-ignore`, `eslint-disable`, or `TODO` comments introduced

### Testing
- [ ] Unit tests written for all new service functions and utilities
- [ ] Integration tests written for all new database interactions
- [ ] Playwright test written for any new user-facing flow
- [ ] All existing tests pass locally
- [ ] Coverage thresholds remain at or above 90% across all metrics

### Security
- [ ] All new Route Handlers validate input with Zod
- [ ] All new protected operations have permission checks in the service layer
- [ ] No secrets, credentials, or internal paths appear in any file
- [ ] `npm audit` reports no HIGH or CRITICAL vulnerabilities

### Accessibility & UI
- [ ] New interactive elements have `data-testid` attributes
- [ ] New components include dark mode styles
- [ ] All images have `alt` text
- [ ] Keyboard navigation works for new interactive elements
- [ ] No accessibility violations reported by `axe-core` (integrated in Playwright tests)

### Documentation
- [ ] `.env.example` updated if new environment variables were added
- [ ] `src/lib/config.ts` updated for new env vars
- [ ] Prisma schema comments updated if schema changed
- [ ] PR description includes summary, what changed, and how to test

### Process
- [ ] PR targets `main` and references an issue
- [ ] Branch name follows `type/description` convention
- [ ] Commit messages follow Conventional Commits
- [ ] CI pipeline passes (all steps green)
- [ ] No unresolved PR review comments
- [ ] Branch deleted after merge
