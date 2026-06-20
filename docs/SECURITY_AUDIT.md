# TeamWiki — Security Audit

**Date:** 2026-06-20
**Scope:** Full codebase review (`main` branch)
**Auditor:** Claude Code (claude-sonnet-4-6)

---

## Executive Summary

TeamWiki has a solid security foundation: Prisma ORM eliminates SQL injection, `rehype-sanitize` guards Markdown rendering, `strict` TypeScript prevents broad classes of bugs, and every Route Handler validates input with Zod before touching services. However, several significant gaps exist. The most urgent are the complete absence of rate limiting on all authentication endpoints, a session expiry mismatch with the documented policy (30-day default vs. 2–8 hour requirement), and the use of a pre-release version of `next-auth`. These three issues in combination meaningfully increase the risk surface for credential-based attacks and session hijacking.

---

## Severity Classification

| Rating | Meaning |
|--------|---------|
| **CRITICAL** | Exploitable with low effort; direct path to data breach or account takeover |
| **HIGH** | Serious risk; exploitable under realistic conditions |
| **MEDIUM** | Defence-in-depth gap or condition that elevates other risks |
| **LOW** | Minor hardening gap, policy deviation, or future risk |
| **INFO** | Observation; not a vulnerability but worth tracking |

---

## Findings

### AUTH-01 — No Rate Limiting on Authentication Endpoints
**Severity: CRITICAL**
**File:** `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/auth/register/route.ts`

There is no rate limiting on login, token refresh, or registration. An attacker can attempt unlimited credential combinations against `/api/auth/callback/credentials` and register unlimited accounts against `POST /api/auth/register`. There is also no account lockout policy enforced in `verifyCredentials`.

```typescript
// src/lib/auth/credentials.ts — unlimited attempts accepted
export async function verifyCredentials(email: string, password: string) {
  // no lockout, no throttle, no attempt counter
  const passwordMatches = await bcryptjs.compare(password, user.passwordHash);
```

**Remediation tasks:**
- [ ] Add an in-process or Redis-backed rate limiter (e.g., `@upstash/ratelimit`) to `/api/auth/callback/credentials` — recommended limit: 10 attempts per IP per minute.
- [ ] Add rate limiting to `POST /api/auth/register` — recommended limit: 5 registrations per IP per hour.
- [ ] Implement a temporary lockout after N consecutive failed login attempts for a given email (e.g., lock for 15 minutes after 10 failures), recorded in the `AuditLog` with `eventType: LOGIN_FAILURE`.
- [ ] Add a new `AuditEventType.LOGIN_FAILURE` to `prisma/schema.prisma` and `audit.ts`.

---

### AUTH-02 — Session Expiry Diverges from Security Policy
**Severity: HIGH**
**File:** `src/lib/auth/config.ts`

CLAUDE.md mandates 8-hour sessions for regular users and 2-hour sessions for admins. The NextAuth configuration does not set a custom `maxAge`, so sessions fall back to NextAuth's 30-day default. A stolen session token is valid for 30 days instead of the intended 2–8 hours.

```typescript
// src/lib/auth/config.ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: 'database' }, // no maxAge set — defaults to 30 days
```

**Remediation tasks:**
- [ ] Add `session: { strategy: 'database', maxAge: 8 * 60 * 60 }` (28 800 seconds) for the standard session duration.
- [ ] Implement role-aware expiry in the `session` callback: if `dbUser.role === 'ADMIN'`, update the session record's `expires` field to `now + 2h` and throw if the existing token has exceeded 2 hours.
- [ ] Add a scheduled job or middleware check that purges expired sessions from the `sessions` table.

---

### AUTH-03 — Pre-release `next-auth` Version
**Severity: HIGH**
**File:** `package.json`

```json
"next-auth": "5.0.0-beta.29"
```

Beta software receives less rigorous CVE tracking, may contain unresolved security issues, and its security API surface is not considered stable. A security regression introduced in a subsequent beta would require emergency patching.

**Remediation tasks:**
- [ ] Pin to the latest stable `next-auth` v4.x release until v5 reaches GA, or upgrade to the GA release once available.
- [ ] Subscribe to the `next-auth` GitHub security advisories.
- [ ] Add a CI step that fails the build if any direct dependency version string contains `-beta`, `-alpha`, or `-rc`.

---

### AUTH-04 — Email Enumeration via Registration Endpoint
**Severity: HIGH**
**File:** `src/lib/services/users.ts`, `src/app/api/auth/register/route.ts`

`POST /api/auth/register` returns HTTP 409 with the message `"Email address is already registered"` when a duplicate email is submitted. This allows an unauthenticated attacker to enumerate which email addresses have accounts.

```typescript
// src/lib/services/users.ts
if (isPrismaUniqueConstraintError(err)) {
  throw new ConflictError('Email address is already registered');
}
```

**Remediation tasks:**
- [ ] Return a generic 200 response for both new and duplicate registrations: `"If this email is not already registered, an account has been created."` (treat registration like a password reset — always success).
- [ ] Alternatively, if open self-registration is intentional and enumeration is acceptable, document this decision explicitly.

---

### AUTH-05 — No Maximum Password Length (bcrypt DoS)
**Severity: HIGH**
**File:** `src/lib/validations/user.ts`

bcrypt silently truncates input at 72 bytes. An attacker can submit a multi-megabyte password string; the pre-truncation memory allocation and string operations may exhaust Node.js heap on the server.

```typescript
// src/lib/validations/user.ts
password: z.string().min(8, '...')  // no max
  .regex(/[A-Z]/, '...')
  .regex(/[0-9]/, '...')
```

**Remediation tasks:**
- [ ] Add `.max(128)` to the `password` field in `createUserSchema`.
- [ ] Also apply the max length check in the login schema to prevent the same attack path through `verifyCredentials`.

---

### XSS-01 — Search Excerpt Contains Unsanitised PostgreSQL HTML
**Severity: HIGH**
**File:** `src/lib/db/search.ts`, downstream search result components

`ts_headline` is configured with HTML marker tags and returns a raw HTML fragment as the `excerpt` field:

```sql
ts_headline(
  'english',
  a.content,
  q,
  'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
) AS excerpt
```

The `excerpt` field is returned in the search API response. If any client component renders it via `dangerouslySetInnerHTML` (a natural pattern for highlighted search snippets), article content that contains HTML is an XSS vector — because `ts_headline` does not sanitise its input before inserting the marker tags, and the article content stored in the database may itself contain HTML (authored by any Editor).

**Remediation tasks:**
- [ ] Sanitise the `excerpt` field server-side in `fullTextSearch` before returning it. Apply `renderMarkdown` (which runs `rehype-sanitize`) or a dedicated HTML sanitiser such as `DOMPurify` (via a Node.js JSDOM context) to `r.excerpt` in the result mapper.
- [ ] Alternatively, use plain-text markers (e.g., `StartSel=[[, StopSel=]]`) and perform client-side highlighting with React without `dangerouslySetInnerHTML`.
- [ ] Audit all search result rendering components and confirm none pass `excerpt` to `dangerouslySetInnerHTML` without sanitisation.

---

### XSS-02 — CSP Allows `unsafe-inline` for Styles
**Severity: MEDIUM**
**File:** `next.config.ts`

```typescript
"style-src 'self' 'unsafe-inline'",
```

`'unsafe-inline'` for `style-src` permits injected `<style>` tags and `style=` attributes. CSS injection enables data exfiltration (via attribute selectors + `background: url()`), UI redressing, and in certain browser contexts can assist XSS escalation.

**Remediation tasks:**
- [ ] Replace `'unsafe-inline'` with a nonce-based or hash-based approach. Next.js supports CSP nonces via middleware since v13.
- [ ] For Tailwind (which uses inline styles only during development), confirm production builds do not require `'unsafe-inline'` and remove it from the production CSP.
- [ ] If inline styles are genuinely required, restrict to `'unsafe-inline'` only in development via an environment-conditional header.

---

### AUTHZ-01 — `/api/mcp/import` Not in Middleware Admin-Path Guard
**Severity: MEDIUM**
**File:** `src/middleware.ts`

```typescript
export function isAdminPath(pathname: string): boolean {
  return pathname.startsWith('/admin') || pathname.startsWith('/api/users');
}
```

`/api/mcp/import` (admin-only import trigger) and admin-only tag mutation endpoints (`POST /api/tags`, `PATCH /api/tags/[slug]`, `DELETE /api/tags/[slug]`) are not covered by `isAdminPath`. Authenticated non-admin users can reach these handlers; authorisation is enforced only at the service layer. The middleware provides no redirect/block as a first line of defence.

**Remediation tasks:**
- [ ] Extend `isAdminPath` to include `/api/mcp` and `/api/tags` (write operations), or generalise to check a route manifest.
- [ ] Consider restructuring admin API routes under `/api/admin/` to make the namespace enforceable by a single `startsWith` check.

---

### AUTHZ-02 — `SYSTEM` Role Assignable via API
**Severity: MEDIUM**
**File:** `src/lib/validations/user.ts`, `src/app/api/users/[id]/route.ts`

`updateUserSchema` uses `z.nativeEnum(Role)`, which includes `SYSTEM`. An Admin can call `PATCH /api/users/[id]` with `{ "role": "SYSTEM" }` to assign the `SYSTEM` role to any user account. A human user with `SYSTEM` role has reduced permissions (`article:read`, `article:create`) compared to `ADMIN`, but the `SYSTEM` role is intended exclusively for machine/service accounts and should not be assignable via API.

```typescript
// src/lib/validations/user.ts
role: z.nativeEnum(Role).optional(),  // Role.SYSTEM is included
```

**Remediation tasks:**
- [ ] Replace `z.nativeEnum(Role)` with an explicit enum of assignable roles: `z.enum(['VIEWER', 'EDITOR', 'ADMIN'])`.
- [ ] Add a unit test asserting that `PATCH /api/users/[id]` with `role: 'SYSTEM'` returns 422.

---

### AUTHZ-03 — `listTags` Permission Check Bypassed
**Severity: LOW**
**File:** `src/lib/services/tags.ts`

```typescript
export async function listTags(session: AppSession): Promise<TagWithCategory[]> {
  void session;  // session is entirely unused
```

The session parameter is discarded. The `articleCount` included in the response reveals content distribution information to all authenticated users. If tags are intended to be admin-only metadata, the permission is missing.

**Remediation tasks:**
- [ ] If tag listing is intentionally public to all authenticated users, remove the unused `session` parameter entirely to signal intent.
- [ ] If tag listing should be admin-restricted, add `requirePermission(session, 'admin:access')`.
- [ ] Remove `articleCount` from `TagWithCategory` returned to non-admin callers, or create a separate trimmed type.

---

### CSRF-01 — No Explicit CSRF Token Validation for API Mutations
**Severity: MEDIUM**
**File:** All Route Handlers under `src/app/api/`

Custom Route Handlers (`POST /api/articles`, `PATCH /api/users/[id]`, `DELETE /api/tags/[slug]`, etc.) rely entirely on `SameSite=Lax` cookie behaviour for CSRF protection. NextAuth's built-in CSRF token only applies to its own auth endpoints. There is no `Origin`/`Referer` verification or explicit CSRF token for application mutations.

`SameSite=Lax` blocks cross-site POST requests from `<form>` elements but does **not** block cross-site requests made via `fetch`/`XMLHttpRequest` from a page with a compromised inline script, nor requests from native apps or API clients.

**Remediation tasks:**
- [ ] Add `Origin` header validation in a shared middleware or wrapper function: reject any mutating request (`POST`, `PATCH`, `PUT`, `DELETE`) whose `Origin` header does not match `NEXTAUTH_URL`.
- [ ] Alternatively, implement a double-submit cookie CSRF pattern or integrate the NextAuth CSRF token into all mutation endpoints.
- [ ] Ensure NextAuth session cookies are set with `SameSite=Strict` rather than the default `Lax`, where application UX allows.

---

### SSRF-01 — Open Redirect via `callbackUrl` Query Parameter
**Severity: MEDIUM**
**File:** `src/middleware.ts`

The middleware sets `callbackUrl` from `req.nextUrl.pathname` (safe), but a user can manually request `/login?callbackUrl=//evil.com`. NextAuth v5-beta's callback URL validation behaviour is not guaranteed stable; if the validation is bypassed or missing, the user is redirected off-site after login.

```typescript
loginUrl.searchParams.set('callbackUrl', pathname);
// Attacker can craft: /login?callbackUrl=https://evil.com
```

**Remediation tasks:**
- [ ] Add explicit validation in the middleware: if `req.nextUrl.searchParams.get('callbackUrl')` exists and is not a relative path starting with `/`, strip it before forwarding.
- [ ] Pin the behaviour with a unit test that asserts absolute external `callbackUrl` values are rejected.
- [ ] Verify NextAuth v5's `allowedRedirectOrigins` or equivalent configuration and set it explicitly.

---

### FILE-01 — No MIME Type Validation for Imported Files
**Severity: MEDIUM**
**File:** `src/lib/mcp/importer.ts`

The import pipeline validates file extension but not MIME type. A file named `payload.md` with binary content passes the extension check. While binary content stored as article text is unlikely to cause direct code execution, it could corrupt the database column or trigger unexpected behaviour in downstream Markdown parsers.

```typescript
// src/lib/mcp/importer.ts
const ALLOWED_EXTENSIONS = new Set(['.md', '.txt', '.markdown']);
// No MIME / content-type check
if (!ALLOWED_EXTENSIONS.has(ext)) { ... }
```

**Remediation tasks:**
- [ ] Use the `file-type` package (pure JS, no native bindings) to detect MIME type from the first bytes of the file content before processing.
- [ ] Reject any file whose detected MIME type is not `text/plain`, `text/markdown`, or `text/x-markdown`.
- [ ] Add the check between the size validation and the deduplication step in `runImportPipeline`.

---

### FILE-02 — No Maximum Article Content Length
**Severity: MEDIUM**
**File:** `src/lib/validations/article.ts`, `src/lib/mcp/importer.ts`

```typescript
// src/lib/validations/article.ts
content: z.string().min(1, 'Content is required'),  // no max
```

An Editor can POST arbitrarily large article content via the API, limited only by network and PostgreSQL's `TEXT` column (effectively unlimited). A 100 MB article body would consume significant memory during Markdown rendering (`renderMarkdown` loads the full string), Prisma deserialization, and PostgreSQL FTS vector computation.

The MCP import pipeline also has no content length check after reading the file (the 10 MB file-size check precedes this, but the pipeline derives body from the file after stripping frontmatter and there is no separate check on the stripped body).

**Remediation tasks:**
- [ ] Add `.max(500_000)` (500 KB) to `content` in `createArticleSchema` and `updateArticleSchema`.
- [ ] Add a content-length guard in `runImportPipeline` after frontmatter stripping: if `body.length > 500_000`, move to `failed/`.
- [ ] Set `bodyParser: { sizeLimit: '1mb' }` in the Next.js route config for article mutation routes to cap the raw HTTP body size.

---

### SECRETS-01 — `process.env` Accessed Directly Outside `config.ts`
**Severity: LOW**
**File:** `src/lib/mcp/importer.ts`, `src/lib/auth/credentials.ts`, `src/lib/services/users.ts`

CLAUDE.md mandates that `process.env` be accessed only through `src/lib/config.ts`, which validates all variables at startup using Zod. Several files bypass this:

```typescript
// src/lib/mcp/importer.ts
id: process.env['SYSTEM_USER_ID'] ?? 'system',

// src/lib/services/users.ts
const BCRYPT_ROUNDS = process.env['NODE_ENV'] === 'test' ? 1 : 12;

// src/lib/mcp/importer.ts
const intervalMs = Number(process.env['IMPORT_POLL_INTERVAL_MS'] ?? 60000);
```

These bypass Zod validation, meaning misconfiguration is not caught at startup and secrets can be silently swallowed with defaults.

**Remediation tasks:**
- [ ] Move all `process.env` reads into `src/lib/config.ts` with appropriate Zod schemas (optional with defaults where applicable).
- [ ] Import `config` from `@/lib/config` in `importer.ts` and `users.ts`.
- [ ] Add a CI lint rule to flag direct `process.env` access outside `config.ts`.

---

### SECRETS-02 — `NEXTAUTH_SECRET` Minimum Length Below Policy
**Severity: LOW**
**File:** `src/lib/config.ts`

CLAUDE.md requires a 64-character hex string. The Zod schema enforces only 32 characters:

```typescript
NEXTAUTH_SECRET: z.string().min(32),
```

**Remediation tasks:**
- [ ] Change `.min(32)` to `.min(64)` to enforce the documented policy.
- [ ] Update `.env.example` comment to reflect the 64-character minimum.

---

### SECRETS-03 — `SYSTEM_USER_ID` Defaults to Non-UUID String
**Severity: LOW**
**File:** `src/lib/mcp/importer.ts`

```typescript
id: process.env['SYSTEM_USER_ID'] ?? 'system',
```

If `SYSTEM_USER_ID` is not set, `authorId` in the created article will be the string `'system'`, which is not a valid UUID. This will cause a database constraint violation on `article.author_id` (a `UUID` column with a foreign key to `users`). The error propagates correctly (import fails, file moves to `failed/`), but the root cause is misleading.

**Remediation tasks:**
- [ ] Make `SYSTEM_USER_ID` a required variable in `config.ts` with Zod UUID validation: `SYSTEM_USER_ID: z.string().uuid()`.
- [ ] Update `.env.example` to document that this must be a UUID matching a seeded system account.
- [ ] Add a seed entry in `prisma/seed.ts` for the system account with a deterministic UUID.

---

### DEPS-01 — `@modelcontextprotocol/sdk` Is Unvetted Infrastructure
**Severity: LOW**
**File:** `package.json`

```json
"@modelcontextprotocol/sdk": "1.11.4"
```

The MCP SDK is a relatively new library with a limited security track record. It is currently used only for the import pipeline (server-side background process), but any vulnerability in it could expose the import directory or server filesystem.

**Remediation tasks:**
- [ ] Subscribe to the `@modelcontextprotocol/sdk` GitHub security advisories.
- [ ] Ensure the MCP SDK is not imported in any client-side bundle (`'use client'` files or components).
- [ ] Add `npm audit --audit-level=high` as a blocking CI step.
- [ ] Consider a `bundlewatch` or `@next/bundle-analyzer` check to confirm MCP SDK is tree-shaken from the client bundle.

---

### DEPS-02 — No Automated Dependency Audit in CI
**Severity: MEDIUM**
**File:** `.github/workflows/ci.yml` (not audited, but referenced)

CLAUDE.md states `npm audit` blocks the build on HIGH or CRITICAL vulnerabilities. This needs verification that the step is actually present in the CI workflow.

**Remediation tasks:**
- [ ] Confirm `npm audit --audit-level=high` is a step in `ci.yml` that fails on non-zero exit code.
- [ ] Add Dependabot auto-merge for patch-level security updates via `.github/dependabot.yml` (already documented in CLAUDE.md but confirm it exists).

---

### RATE-01 — No Rate Limiting on Search or Any Application API
**Severity: MEDIUM**
**File:** `src/app/api/search/route.ts` and all other Route Handlers

The full-text search endpoint executes a potentially expensive PostgreSQL FTS query (`websearch_to_tsquery` + `tsvector @@ tsquery` with GIN index) on every request. No rate limiting exists on any API endpoint beyond the authentication check.

**Remediation tasks:**
- [ ] Apply rate limiting to `GET /api/search`: recommended 30 requests per minute per authenticated user.
- [ ] Apply rate limiting to all write endpoints (`POST /api/articles`, `PATCH`, `DELETE`) to prevent bulk mutation abuse.
- [ ] Consider a shared rate-limit middleware wrapper that can be applied per-route or globally.

---

## Summary Table

| ID | Area | Title | Severity |
|----|------|-------|----------|
| AUTH-01 | Authentication | No rate limiting on auth endpoints | **CRITICAL** |
| AUTH-02 | Authentication | Session expiry defaults to 30 days | **HIGH** |
| AUTH-03 | Authentication | `next-auth` beta version in production | **HIGH** |
| AUTH-04 | Authentication | Email enumeration via register endpoint | **HIGH** |
| AUTH-05 | Authentication | No maximum password length (bcrypt DoS) | **HIGH** |
| XSS-01 | XSS | Search excerpt contains unsanitised HTML | **HIGH** |
| XSS-02 | XSS | CSP `style-src` allows `unsafe-inline` | **MEDIUM** |
| AUTHZ-01 | Authorization | `/api/mcp/import` missing middleware guard | **MEDIUM** |
| AUTHZ-02 | Authorization | `SYSTEM` role assignable via API | **MEDIUM** |
| AUTHZ-03 | Authorization | `listTags` ignores session parameter | **LOW** |
| CSRF-01 | CSRF | No `Origin` validation on mutation endpoints | **MEDIUM** |
| SSRF-01 | SSRF | Open redirect via `callbackUrl` parameter | **MEDIUM** |
| FILE-01 | File Import | No MIME type validation | **MEDIUM** |
| FILE-02 | File Import | No maximum article content length | **MEDIUM** |
| SECRETS-01 | Secrets | `process.env` accessed outside `config.ts` | **LOW** |
| SECRETS-02 | Secrets | `NEXTAUTH_SECRET` minimum below policy | **LOW** |
| SECRETS-03 | Secrets | `SYSTEM_USER_ID` defaults to non-UUID | **LOW** |
| DEPS-01 | Dependencies | `@modelcontextprotocol/sdk` unvetted | **LOW** |
| DEPS-02 | Dependencies | `npm audit` not confirmed in CI | **MEDIUM** |
| RATE-01 | Rate Limiting | No rate limiting on search or app APIs | **MEDIUM** |

---

## What Is Well Implemented

The following controls are correctly implemented and should be preserved:

| Control | Location |
|---------|----------|
| All Prisma ORM queries are parameterised; raw SQL uses tagged template literals | `src/lib/db/search.ts` |
| Markdown rendered through `remark` → `rehype-sanitize` → `rehypeStringify`; no unsafe HTML emitted | `src/lib/utils/markdown.ts` |
| `dangerouslySetInnerHTML` used only in `MarkdownPreview` after sanitisation | `src/components/articles/MarkdownPreview.tsx` |
| Defence-in-depth: permission checks at middleware, Route Handler, and service layer | `src/middleware.ts`, service files |
| Session re-read from DB on every request; deactivated users denied immediately | `src/lib/auth/config.ts` |
| bcrypt with 12 rounds in production; `bcryptjs` (pure JS, no native binding supply-chain risk) | `src/lib/services/users.ts` |
| Structured logger redacts `password`, `token`, `secret`, `key`, `accessToken` | `src/lib/logger.ts` |
| All environment variables validated at startup via Zod in `config.ts` | `src/lib/config.ts` |
| `passwordHash` excluded from all API response select clauses | `src/lib/services/users.ts` |
| Path traversal protection in MCP client validates both source and destination paths | `src/lib/mcp/client.ts` |
| MCP import creates articles in `DRAFT` status; requires human review before publishing | `src/lib/services/articles.ts` |
| Dependency versions pinned to exact strings; no `^` or `~` ranges | `package.json` |
| All HTTP security headers present and correctly configured (HSTS, X-Frame-Options, etc.) | `next.config.ts` |
| RBAC implemented in the service layer; `VIEWER` role cannot write; `EDITOR` cannot delete | `src/lib/auth/permissions.ts` |
| `tagIds` validated as UUID array before DB operations; prevents tag ID injection | `src/lib/validations/article.ts` |
| Audit log records all significant mutations; swallowed non-blocking to avoid main-path failure | `src/lib/services/audit.ts` |
| `.env` and `.mcp.json` correctly gitignored | `.gitignore` |

---

## Recommended Remediation Priority

**Immediate (before next production deploy):**
1. AUTH-01 — Add rate limiting to login and registration
2. AUTH-02 — Set `session.maxAge` in NextAuth config
3. AUTH-05 — Add `password.max(128)` to validation schemas
4. XSS-01 — Sanitise `ts_headline` excerpt output

**Within one sprint:**
5. AUTH-03 — Evaluate path to stable `next-auth`
6. AUTH-04 — Remove email enumeration from register response
7. CSRF-01 — Add `Origin` header validation middleware
8. DEPS-02 — Confirm and enforce `npm audit` in CI
9. RATE-01 — Add per-user rate limits on search and write APIs

**Within one quarter:**
10. XSS-02 — Migrate CSP from `unsafe-inline` to nonce-based styles
11. AUTHZ-01 — Extend middleware admin-path guard
12. AUTHZ-02 — Remove `SYSTEM` from assignable roles in API
13. SSRF-01 — Validate `callbackUrl` in middleware
14. FILE-01 — Add MIME type validation to MCP importer
15. FILE-02 — Add content length limit to article schema
16. SECRETS-01–03 — Centralise env access; tighten secret policies
