# TeamWiki — Technical Specification

**Version:** 1.0  
**Status:** Approved  
**Governed by:** `CLAUDE.md` (all standards in this document derive from or extend `CLAUDE.md`)

---

## Table of Contents

1. [Requirements](#1-requirements)
2. [Technical Design](#2-technical-design)
3. [Implementation Plan](#3-implementation-plan)
4. [Testing Strategy](#4-testing-strategy)
5. [Security Requirements](#5-security-requirements)
6. [MCP Integration](#6-mcp-integration)
7. [CI/CD Pipeline](#7-cicd-pipeline)
8. [Scope Boundaries](#8-scope-boundaries)
9. [Success Criteria](#9-success-criteria)

---

## 1. Requirements

### 1.1 User Stories & Acceptance Criteria

---

#### AUTH-01 — Login

> As a team member, I want to log in with my email and password so that I can access the knowledge base.

**Acceptance criteria:**
- Given valid credentials, the user is redirected to `/articles` with an active database session.
- Given invalid credentials, an error message is shown; no session is created.
- Given a deactivated account, login is rejected with a clear message.
- Sessions for Admin users expire after 2 hours; all other sessions expire after 8 hours.
- Credentials are never stored in plain text; `bcryptjs` hashes are used.

---

#### AUTH-02 — Register

> As a new team member, I want to register an account so that I can start using the wiki.

**Acceptance criteria:**
- A valid email + name + password (min 8 chars) creates a user with `VIEWER` role.
- Duplicate email returns a 409 Conflict with a clear message.
- Passwords are hashed before storage; the hash is never returned to the client.

---

#### AUTH-03 — Logout

> As a logged-in user, I want to log out so that my session is invalidated.

**Acceptance criteria:**
- Logout deletes the database session record.
- After logout, navigating to any protected route redirects to `/login`.

---

#### ARTICLE-01 — Browse Articles

> As a Viewer, I want to see a list of published articles so that I can find knowledge quickly.

**Acceptance criteria:**
- The article list shows title, author, tags, and published date.
- Only `PUBLISHED` articles are shown to Viewers; Editors also see their own `DRAFT` articles; Admins see all.
- List is paginated (20 per page).
- Each article card links to the article view page.

---

#### ARTICLE-02 — View an Article

> As a Viewer, I want to read an article so that I can access team knowledge.

**Acceptance criteria:**
- Article content is rendered from Markdown with sanitized HTML.
- Author name, publish date, and tags are shown.
- A `DRAFT` article is only visible to its author or an Admin.
- Attempting to access an inaccessible article returns a 404 page (not a 403, to avoid enumeration).

---

#### ARTICLE-03 — Create an Article

> As an Editor, I want to create a new article with a Markdown editor so that I can share knowledge.

**Acceptance criteria:**
- The editor provides a live preview pane alongside the Markdown input.
- Title, content, tags (multi-select), and status (`DRAFT` / `PUBLISHED`) are required/optional fields.
- Saving creates the article and simultaneously creates revision #1.
- A unique URL slug is auto-generated from the title; collisions are resolved by appending a numeric suffix.
- Viewing an article immediately after creation navigates to the article view page.

---

#### ARTICLE-04 — Edit an Article

> As an Editor, I want to edit my own articles so that I can keep knowledge current.

**Acceptance criteria:**
- The editor pre-populates with the current title, content, tags, and status.
- Saving an edit creates a new revision snapshot (revision N+1) in the same database transaction as the update.
- An Editor can only edit articles they authored; an Admin can edit any article.
- The edit button is only shown to authorized users.

---

#### ARTICLE-05 — Delete an Article

> As an Admin, I want to delete articles so that I can remove stale or incorrect content.

**Acceptance criteria:**
- Only Admin users see the delete action.
- Deletion requires a confirmation step (modal) before proceeding.
- Deleting an article cascades and removes all its revisions, tags associations, and audit log target references.

---

#### SEARCH-01 — Full-Text Search

> As a user, I want to search across all published articles so that I can find content without knowing the exact location.

**Acceptance criteria:**
- Searching by keyword returns ranked results from article titles and content.
- Title matches rank higher than content matches.
- Results show a highlighted excerpt with matched terms wrapped in `<mark>`.
- Results can be filtered by one or more tags.
- Empty query returns no results (not an error).
- Search is accessible from the top navigation bar on all dashboard pages.

---

#### REVISION-01 — View Revision History

> As a Viewer, I want to see the revision history of an article so that I can understand how it evolved.

**Acceptance criteria:**
- The history page lists all revisions in reverse chronological order with revision number, author, date, and change summary.
- Clicking a revision shows its full snapshot content.

---

#### REVISION-02 — Compare Revisions (Diff)

> As a Viewer, I want to compare two revisions side-by-side so that I can see exactly what changed.

**Acceptance criteria:**
- The user can select any two revisions to compare.
- Additions are highlighted in green; deletions in red; unchanged lines are neutral.
- Both unified (GitHub-style) and split (side-by-side) views are available via toggle.
- The diff is computed on Markdown source text (line-level).

---

#### TAG-01 — Browse by Tag

> As a Viewer, I want to browse articles by tag so that I can explore related content.

**Acceptance criteria:**
- A tags page lists all tags with their category and article count.
- Clicking a tag shows all published articles with that tag.

---

#### TAG-02 — Manage Tags

> As an Editor, I want to create new tags so that I can organize articles.
> As an Admin, I want to edit and delete tags so that I can maintain taxonomy.

**Acceptance criteria:**
- Editors can create tags (name auto-generates a slug).
- Admins can rename tags and reassign their category.
- Deleting a tag removes it from all articles (join table rows are cascade-deleted).
- A tag name must be unique.

---

#### ADMIN-01 — User Management

> As an Admin, I want to view and manage all users so that I can control access.

**Acceptance criteria:**
- User list shows email, name, role, active status, and join date.
- Admin can change any user's role (`VIEWER`, `EDITOR`, `ADMIN`).
- Admin can deactivate a user (soft-delete via `isActive = false`).
- Deactivated users cannot log in.
- Role changes take effect on the user's next request (session re-read from DB).
- An Admin cannot deactivate themselves.

---

#### ADMIN-02 — Admin Dashboard

> As an Admin, I want to see key stats so that I can monitor platform health.

**Acceptance criteria:**
- Dashboard shows: total articles, total users by role, articles published this month, recent MCP imports.
- Stats are read-only, computed server-side.

---

#### MCP-01 — Document Import

> As an Admin, I want documents placed in the import directory to be automatically imported as draft articles so that I can migrate content into the wiki.

**Acceptance criteria:**
- Files with extensions `.md`, `.txt`, `.markdown` placed in `IMPORT_DIR` are picked up within the polling interval (default 60 s).
- Files exceeding 10 MB or with unsupported extensions are rejected and moved to `IMPORT_DIR/failed/`.
- Imported articles are created with `DRAFT` status; they require Editor/Admin review before publishing.
- Each import (success or failure) is recorded in `audit_logs`.
- A file is never deleted on failure — only moved to `failed/`.
- Already-processed files are not re-imported (fingerprint check via `metadata` JSONB).

---

## 2. Technical Design

### 2.1 Data Model

#### Enumerations

```
Role:          VIEWER | EDITOR | ADMIN | SYSTEM
ArticleStatus: DRAFT | PUBLISHED | ARCHIVED
AuditEventType:
  ARTICLE_CREATED | ARTICLE_UPDATED | ARTICLE_DELETED |
  MCP_IMPORT_SUCCESS | MCP_IMPORT_FAILURE |
  USER_ROLE_CHANGED | USER_DEACTIVATED
```

#### Tables

**`users`**

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, `gen_random_uuid()` |
| email | VARCHAR(254) | UNIQUE NOT NULL |
| name | VARCHAR(100) | NOT NULL |
| password_hash | TEXT | NULLABLE (null for future OAuth users) |
| role | Role enum | NOT NULL DEFAULT `VIEWER` |
| is_active | BOOLEAN | NOT NULL DEFAULT `true` |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT `now()` |
| updated_at | TIMESTAMPTZ | NOT NULL, `@updatedAt` |

**`accounts`** (NextAuth OAuth — reserved for future OAuth providers)

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id CASCADE |
| type, provider, provider_account_id | TEXT | UNIQUE(provider, provider_account_id) |
| refresh_token, access_token, id_token | TEXT | NULLABLE |
| expires_at | BIGINT | NULLABLE |

**`sessions`** (NextAuth database sessions)

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| session_token | TEXT | UNIQUE NOT NULL |
| user_id | UUID | FK → users.id CASCADE |
| expires | TIMESTAMPTZ | NOT NULL |

**`verification_tokens`** (NextAuth)

| Column | Type | Constraints |
|---|---|---|
| identifier | TEXT | |
| token | TEXT | UNIQUE |
| expires | TIMESTAMPTZ | |
| PK | (identifier, token) | |

**`categories`**

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(100) | UNIQUE NOT NULL |
| slug | VARCHAR(100) | UNIQUE NOT NULL |
| description | TEXT | NULLABLE |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT `now()` |

**`tags`**

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(50) | UNIQUE NOT NULL |
| slug | VARCHAR(50) | UNIQUE NOT NULL |
| category_id | UUID | NULLABLE FK → categories.id SET NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT `now()` |

**`articles`**

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| slug | VARCHAR(255) | UNIQUE NOT NULL |
| title | VARCHAR(500) | NOT NULL |
| content | TEXT | NOT NULL |
| status | ArticleStatus | NOT NULL DEFAULT `DRAFT` |
| author_id | UUID | FK → users.id RESTRICT |
| published_at | TIMESTAMPTZ | NULLABLE |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT `now()` |
| updated_at | TIMESTAMPTZ | NOT NULL, `@updatedAt` |
| search_vector | tsvector | Trigger-managed; `Unsupported` in Prisma |

**`article_tags`** (join table)

| Column | Type | Constraints |
|---|---|---|
| article_id | UUID | FK → articles.id CASCADE |
| tag_id | UUID | FK → tags.id CASCADE |
| PK | (article_id, tag_id) | |

**`article_revisions`**

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| article_id | UUID | FK → articles.id CASCADE |
| revision_number | INT | NOT NULL |
| title | VARCHAR(500) | NOT NULL (snapshot) |
| content | TEXT | NOT NULL (snapshot) |
| author_id | UUID | FK → users.id RESTRICT |
| change_summary | TEXT | NULLABLE |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT `now()` |
| UNIQUE | (article_id, revision_number) | |

**`audit_logs`**

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| event_type | AuditEventType | NOT NULL |
| actor_id | UUID | NULLABLE FK → users.id SET NULL |
| target_id | UUID | NULLABLE |
| target_type | VARCHAR(50) | NULLABLE (`'article'` or `'user'`) |
| metadata | JSONB | NULLABLE |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT `now()` |

**Indexes:**
```sql
CREATE INDEX articles_search_vector_idx ON articles USING GIN(search_vector);
CREATE INDEX articles_author_id_idx     ON articles(author_id);
CREATE INDEX articles_status_idx        ON articles(status);
CREATE INDEX articles_published_at_idx  ON articles(published_at DESC);
CREATE INDEX revisions_lookup_idx       ON article_revisions(article_id, revision_number DESC);
CREATE INDEX tags_category_id_idx       ON tags(category_id);
CREATE INDEX sessions_user_id_idx       ON sessions(user_id);
CREATE INDEX audit_logs_created_at_idx  ON audit_logs(created_at DESC);
CREATE INDEX audit_logs_actor_id_idx    ON audit_logs(actor_id);
```

---

### 2.2 ER Diagram

```
┌──────────┐       ┌──────────────┐       ┌────────────────┐
│  users   │──1:N──│   articles   │──1:N──│article_revision│
│          │       │              │       │                │
│ id (PK)  │       │ id (PK)      │       │ id (PK)        │
│ email    │       │ slug         │       │ article_id (FK)│
│ name     │       │ title        │       │ revision_number│
│ role     │       │ content      │       │ title (snap)   │
│ is_active│◄──────│ author_id(FK)│       │ content (snap) │
└──────────┘       │ status       │       │ author_id (FK) │
     │             │ search_vector│       │ change_summary │
     │1:N          └──────┬───────┘       └────────────────┘
     ▼                    │M:N
┌──────────┐       ┌──────┴───────┐       ┌────────────┐
│ sessions │       │ article_tags │       │    tags    │
│(NextAuth)│       │              │◄──N:1──│            │
└──────────┘       │ article_id   │       │ id (PK)    │
                   │ tag_id       │       │ name       │
┌──────────┐       └──────────────┘       │ slug       │
│ accounts │                              │ category_id│
│(NextAuth)│                              └─────┬──────┘
└──────────┘                                    │N:1
                   ┌──────────────┐       ┌─────▼──────┐
                   │  audit_logs  │       │ categories │
                   │              │       │            │
                   │ event_type   │       │ id (PK)    │
                   │ actor_id(FK) │       │ name       │
                   │ target_id    │       │ slug       │
                   │ metadata JSONB       └────────────┘
                   └──────────────┘

Cardinalities:
  User ──1:N──► Article          (author; RESTRICT on user delete)
  User ──1:N──► ArticleRevision  (author; RESTRICT on user delete)
  User ──1:N──► Session          (CASCADE on user delete)
  User ──1:N──► Account          (CASCADE on user delete)
  User ──1:N──► AuditLog         (actor; SET NULL on user delete — preserves audit trail)
  Article ──1:N──► ArticleRevision (CASCADE on article delete)
  Article ──M:N──► Tag            (via article_tags; CASCADE both sides)
  Tag ──N:1──► Category           (SET NULL on category delete)
```

---

### 2.3 API Contracts

#### Authentication

```
POST /api/auth/register
  Body:     { email: string, name: string, password: string (min 8) }
  Success:  201 { id, email, name, role: "VIEWER" }
  Errors:   409 (email exists), 422 (validation)

POST /api/auth/[...nextauth]   — NextAuth internal handler
GET  /api/auth/[...nextauth]   — NextAuth internal handler
```

#### Articles

```
GET /api/articles?status=&page=&limit=&authorId=
  Auth:     Required
  Success:  200 { data: ArticleSummary[], meta: { total, page, limit, totalPages } }

POST /api/articles
  Auth:     Required (Editor+)
  Body:     { title, content, tagIds?: string[], status?: "DRAFT"|"PUBLISHED", changeSummary?: string }
  Success:  201 { id, slug, title, status, createdAt }
  Errors:   403, 422

GET /api/articles/[slug]
  Auth:     Required (Viewer+)
  Success:  200 { id, slug, title, content, status, publishedAt, author: {id,name},
                  tags: TagSummary[], revisionCount: number }
  Errors:   404 (also returned for unauthorized DRAFT to avoid enumeration)

PATCH /api/articles/[slug]
  Auth:     Required (Editor-own | Admin)
  Body:     { title?, content?, tagIds?, status?, changeSummary? }
  Success:  200 updated article
  Errors:   403, 404, 422

DELETE /api/articles/[slug]
  Auth:     Required (Admin)
  Success:  204
  Errors:   403, 404

GET /api/articles/[slug]/revisions
  Auth:     Required (Viewer+)
  Success:  200 { revisions: [{ id, revisionNumber, authorName, createdAt, changeSummary }] }

GET /api/articles/[slug]/revisions/[revisionId]
  Auth:     Required (Viewer+)
  Success:  200 { id, revisionNumber, title, content, authorName, createdAt, changeSummary }
  Errors:   404
```

#### Search

```
GET /api/search?q=string&tags=slug1,slug2&page=1&limit=20
  Auth:     Required (Viewer+)
  Success:  200 { results: [{ id, slug, title, authorName, publishedAt, rank, excerpt }],
                  meta: { total, page, limit, totalPages }, query: string }
  Notes:    Empty q returns 200 with empty results array.
```

#### Tags

```
GET /api/tags
  Auth:     Required (Viewer+)
  Success:  200 { tags: [{ id, name, slug, category: {id,name,slug}|null, articleCount }] }

POST /api/tags
  Auth:     Required (Editor+)
  Body:     { name: string, categoryId?: string }
  Success:  201 { id, name, slug, categoryId }
  Errors:   409 (name exists), 422

PATCH /api/tags/[slug]
  Auth:     Required (Admin)
  Body:     { name?, categoryId? }
  Success:  200 updated tag

DELETE /api/tags/[slug]
  Auth:     Required (Admin)
  Success:  204

GET /api/tags/[slug]/articles?page=&limit=
  Auth:     Required (Viewer+)
  Success:  200 { data: ArticleSummary[], meta: PaginationMeta }
```

#### Users / Admin

```
GET /api/users?page=&limit=&role=
  Auth:     Required (Admin)
  Success:  200 { data: [{ id, email, name, role, isActive, createdAt }], meta: PaginationMeta }

GET /api/users/[id]
  Auth:     Required (Admin | self)
  Success:  200 { id, email, name, role, isActive, createdAt }

PATCH /api/users/[id]
  Auth:     Required
  Body:     { role?, isActive?, name? }
  Rules:    role/isActive changes: Admin only; name change: self or Admin
  Success:  200 updated user (no passwordHash)
  Errors:   403, 404, 422

DELETE /api/users/[id]
  Auth:     Required (Admin)
  Notes:    Soft-delete (sets isActive=false); Admin cannot delete themselves
  Success:  204
  Errors:   403, 404, 409 (self-delete)
```

#### Shared Response Shapes

```typescript
// Pagination meta
type PaginationMeta = { total: number; page: number; limit: number; totalPages: number };

// Error
type ErrorResponse = { error: { code: string; message: string; details?: unknown } };

// HTTP status mapping
NotFoundError    → 404 | NOT_FOUND
ForbiddenError   → 403 | FORBIDDEN
UnauthorizedError→ 401 | UNAUTHORIZED
ValidationError  → 422 | VALIDATION_ERROR
ConflictError    → 409 | CONFLICT
Unhandled        → 500 | INTERNAL_ERROR (stack never exposed to client)
```

---

### 2.4 Component Hierarchy

```
app/layout.tsx                     [Server] — RootLayout, ThemeProvider
│
├── (auth)/layout.tsx              [Server] — centered card layout
│   ├── login/page.tsx             [Server]
│   │   └── LoginForm.tsx          [Client] — form state, validation, server action
│   └── register/page.tsx          [Server]
│       └── RegisterForm.tsx       [Client]
│
└── (dashboard)/layout.tsx         [Server] — sidebar + topbar shell
    ├── components/Sidebar.tsx     [Server]
    │   ├── NavLinks.tsx           [Server]
    │   └── UserMenu.tsx           [Client] — avatar dropdown
    ├── components/TopBar.tsx      [Server]
    │   └── search/SearchInput.tsx [Client] — debounced input → /api/search
    │
    ├── articles/page.tsx          [Server] — article list
    │   └── <Suspense> → articles/ArticleList.tsx   [Server]
    │       └── articles/ArticleCard.tsx[]           [Server]
    │           └── articles/TagBadge.tsx[]          [Server]
    │
    ├── articles/new/page.tsx      [Server] — auth gate
    │   └── editor/ArticleEditorForm.tsx [Client]
    │       ├── editor/MarkdownEditor.tsx [Client] — @uiw/react-md-editor
    │       ├── articles/TagSelector.tsx  [Client] — combobox, calls /api/tags
    │       └── articles/StatusSelector.tsx [Client]
    │
    ├── articles/[slug]/
    │   ├── page.tsx               [Server]
    │   │   ├── <Suspense> → articles/ArticleContent.tsx [Server]
    │   │   │   ├── articles/RenderedMarkdown.tsx   [Server] — remark pipeline
    │   │   │   └── articles/ArticleMetadata.tsx    [Server]
    │   │   ├── articles/TagBadge.tsx[]             [Server]
    │   │   └── articles/ArticleActions.tsx         [Client] — edit/delete buttons
    │   ├── edit/page.tsx          [Server] — auth gate
    │   │   └── editor/ArticleEditorForm.tsx [Client] — pre-populated
    │   ├── history/page.tsx       [Server]
    │   │   ├── articles/RevisionList.tsx   [Server]
    │   │   │   └── articles/RevisionRow.tsx[] [Server]
    │   │   └── diff/DiffViewer.tsx         [Client] — receives two snapshots as props
    │   │       └── diff/DiffOutput.tsx     [Client] — line-level diff rendering
    │   └── error.tsx              [Server] — error boundary
    │
    ├── search/page.tsx            [Server] — reads ?q from searchParams
    │   └── search/SearchResults.tsx [Client] — live re-query on input change
    │       └── search/SearchResultCard.tsx [Client] — title + highlighted excerpt
    │
    ├── tags/page.tsx              [Server]
    │   └── articles/TagGrid.tsx  [Server]
    │       └── articles/TagCard.tsx[] [Server]
    │
    └── admin/
        ├── page.tsx               [Server] — role gate (Admin)
        │   └── admin/StatsCards.tsx [Server]
        └── users/
            ├── page.tsx           [Server]
            │   └── admin/UserTable.tsx [Client] — sortable, inline role change
            │       └── admin/RoleSelector.tsx [Client]
            └── [id]/page.tsx      [Server]
                └── admin/UserEditForm.tsx [Client]
```

**Rules enforced throughout:**
- Every `[Client]` component is a leaf node — no direct data fetching.
- `data-testid` is required on every interactive element targeted by tests.
- Every component includes `dark:` Tailwind variant classes.
- No `dangerouslySetInnerHTML` anywhere.

---

### 2.5 Authentication Flow

```
User submits credentials
       │
       ▼
NextAuth Credentials Provider
  → validateCredentials(email, password)
  → prisma.user.findUnique({ where: { email } })
  → bcryptjs.compare(password, passwordHash)
  → if !user.isActive → reject ("Account is disabled")
  → if mismatch → reject ("Invalid credentials")
       │
       ▼ (success)
NextAuth session callback
  → reads user.role from DB (not cached in token — ensures immediate role-change effect)
  → constructs AppSession: { user: { id, email, name, role }, expires }
  → sets session maxAge: role === 'ADMIN' ? 7200 : 28800
       │
       ▼
Database session record created in `sessions` table
Session cookie set (HttpOnly, Secure, SameSite=Lax)
       │
       ▼
Redirect to /articles (or callbackUrl)

─────────────────────────────────────────────────
Subsequent Requests:

Request arrives → middleware.ts
  → auth() reads session cookie → looks up sessions table
  → if no session or expired → redirect to /login?callbackUrl=...
  → if /admin/* and role !== ADMIN → redirect to /403
  → pass through to route handler / Server Component

Route Handler / Server Component:
  → const session = await auth()
  → if (!session) return 401
  → pass session explicitly to service: service.doThing(params, session)

Service Layer:
  → checks hasPermission(session.user.role, 'permission:name')
  → throws ForbiddenError if unauthorized
  → proceeds with DB operation
```

---

### 2.6 Authorization Flow

```
Permission check waterfall (defense in depth):

Layer 1 — Middleware (route-level):
  /login, /register       → public
  /(dashboard)/*          → session required
  /admin/*                → session required AND role === ADMIN

Layer 2 — Service layer (operation-level, src/lib/auth/permissions.ts):

  ROLE_PERMISSIONS map:
    VIEWER:  [article:read]
    EDITOR:  [article:read, article:create, article:edit:own]
    ADMIN:   [article:read, article:create, article:edit:own,
              article:edit:any, article:delete, admin:access, user:manage]
    SYSTEM:  [article:read, article:create]   ← MCP service account

  canEditArticle(session, article):
    returns hasPermission(role, 'article:edit:any')
         OR (hasPermission(role, 'article:edit:own') AND article.authorId === session.user.id)

  Every mutating service function:
    1. Fetch the resource (throw NotFoundError if missing)
    2. Check permission (throw ForbiddenError if unauthorized)
    3. Execute the DB operation

Layer 3 — Response (no sensitive data leakage):
    DRAFT articles 404 (not 403) for unauthorized users — prevents enumeration
    API responses never include: passwordHash, sessionToken, internal IDs beyond client need
```

---

### 2.7 Search Architecture

```
Write path (automatic, trigger-based):
  INSERT or UPDATE articles (title or content)
    → PostgreSQL trigger fires BEFORE INSERT OR UPDATE OF title, content
    → articles_search_vector_update() sets:
         search_vector =
           setweight(to_tsvector('english', title), 'A') ||
           setweight(to_tsvector('english', content), 'B')
    → GIN index on search_vector updated by PostgreSQL automatically

Read path:
  GET /api/search?q=...&tags=...
    → Route Handler validates Zod (q: string, tags: string[], page, limit)
    → searchService.search(q, tagSlugs, page, limit, session)
        → db/search.ts fullTextSearch() executes raw parameterized SQL:

           websearch_to_tsquery('english', $1) — safe user input parsing
           search_vector @@ query              — index scan via GIN
           ts_rank_cd(search_vector, query)    — cover density ranking
           ts_headline(content, query, ...)    — excerpt with <mark> highlights

        → db/search.ts countSearchResults() — same WHERE clause, COUNT(*) only
    → Returns: ranked results + pagination meta

Ranking strategy:
  ts_rank_cd preferred over ts_rank — rewards term proximity
  Normalization option 32: rank / (rank + 1) → 0..1 range
  Title weight A > content weight B — title matches rank higher

Query safety:
  websearch_to_tsquery safely handles: quoted phrases, -negation, OR operators
  All values passed as $N parameters — no string interpolation
```

---

### 2.8 Revision Architecture

```
Creation rules:
  Article create → prisma.$transaction([
    article.create(...),
    articleRevision.create({ revisionNumber: 1, title, content, authorId })
  ])

  Article update → prisma.$transaction([
    article.update(...),
    articleRevision.create({ revisionNumber: maxRevisionNumber + 1, title, content, authorId })
  ])

  The `articles` table IS the current state.
  There is no "current revision" pointer.
  Revision N = state after the Nth save.
  Revision #1 = initial creation snapshot.

Immutability:
  `article_revisions` rows are never updated or deleted individually.
  They are only deleted via CASCADE when the parent article is deleted.

Diff computation (client-side):
  ArticleHistoryPage (Server) fetches:
    - Full revision list (id, revisionNumber, authorName, createdAt, changeSummary)
    - When user selects two revisions → fetches full content for each from /api/articles/[slug]/revisions/[id]
  DiffViewer (Client Component) receives both revision objects as props:
    useMemo(() => Diff.createPatch(base.title, base.content, head.content), [base, head])
  Renders hunk-by-hunk:
    + lines: green background
    - lines: red background
    unchanged: neutral
  Toggle (useState): unified view | split view
  No server round-trip for diff computation.
```

---

## 3. Implementation Plan

### Phases Overview

| # | Phase | Hours |
|---|---|---|
| 1 | Project Foundation | 12h |
| 2 | Database & ORM | 8h |
| 3 | Authentication | 10h |
| 4 | Article CRUD + Revisions | 14h |
| 5 | Tags & Categories | 6h |
| 6 | Full-Text Search | 6h |
| 7 | Admin Dashboard | 8h |
| 8 | MCP Import Pipeline | 8h |
| 9 | Polish & Accessibility | 6h |
| 10 | Coverage & CI Hardening | 4h |
| | **Total** | **82h** |

---

### Phase 1 — Project Foundation (12h)

**Goal:** Runnable Next.js 15 skeleton with all tooling configured. Zero features yet.

**Deliverables:**

| File | Purpose |
|---|---|
| `package.json` | All deps pinned to exact versions (no `^` or `~`) |
| `tsconfig.json` | `strict: true`, path alias `@/*` → `src/*` |
| `next.config.ts` | Security headers, image domains |
| `tailwind.config.ts` | Design tokens, `darkMode: 'class'` |
| `.eslintrc.json` | Next.js + TypeScript + import-order rules |
| `.prettierrc` | Prettier Tailwind class-sort plugin |
| `jest.config.ts` | Unit test config, coverage thresholds |
| `jest.integration.config.ts` | Integration test config, 30s timeout |
| `playwright.config.ts` | E2E config with `webServer` + `axe-core` |
| `src/lib/config.ts` | Env var Zod schema (grows each phase) |
| `src/lib/logger.ts` | Pino structured logger with redaction |
| `src/lib/errors.ts` | Full typed error class hierarchy |
| `src/types/index.ts` | Base TypeScript types |
| `src/app/layout.tsx` | Root layout + dark mode provider |
| `src/app/not-found.tsx` | 404 page |
| `tests/unit/setup.ts` | Prisma mock setup |
| `.env.example` | All env var placeholders |
| `.github/workflows/ci.yml` | |
| `.github/workflows/e2e.yml` | |
| `.github/dependabot.yml` | Weekly npm updates |
| `.mcp.json.example` | MCP config template |

**Dependencies:** None.

---

### Phase 2 — Database & ORM (8h)

**Goal:** Prisma schema, migrations with FTS trigger, Prisma singleton, integration test DB helpers.

**Deliverables:**

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Complete schema: all models, enums, relations, `@@map` |
| `prisma/migrations/<ts>_initial/` | Generated by `prisma migrate dev`; FTS trigger SQL added manually |
| `prisma/seed.ts` | SYSTEM user, 1 Admin, 2 Editors, 2 Viewers, categories, tags, 3 articles with revisions |
| `src/lib/db/client.ts` | Prisma singleton (global pattern for Next.js hot-reload safety) |
| `src/lib/db/search.ts` | `fullTextSearch()` and `countSearchResults()` raw SQL stubs |
| `tests/integration/helpers/db.ts` | `resetDatabase()` — FK-safe delete order |
| `tests/integration/globalSetup.ts` | `prisma migrate deploy` on `teamwiki_test` |
| `tests/integration/globalTeardown.ts` | Disconnect Prisma client |

**Dependencies:** Phase 1.

---

### Phase 3 — Authentication (10h)

**Goal:** Working login/register/logout, session management, RBAC foundation, middleware.

**Deliverables:**

| File | Purpose |
|---|---|
| `src/lib/auth/config.ts` | NextAuth v5 Credentials provider, Prisma adapter, session/signIn callbacks |
| `src/lib/auth/permissions.ts` | `ROLE_PERMISSIONS`, `hasPermission`, `canEditArticle` |
| `src/middleware.ts` | Route protection + admin guard |
| `src/lib/validations/user.ts` | `createUserSchema`, `loginSchema`, `updateUserSchema` |
| `src/lib/services/users.ts` | `register`, `findById`, `update`, `deactivate` |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth catch-all |
| `src/app/api/auth/register/route.ts` | POST registration |
| `src/app/(auth)/layout.tsx` + pages | Login + Register Server Component shells |
| `src/components/ui/LoginForm.tsx` | Client Component |
| `src/components/ui/RegisterForm.tsx` | Client Component |
| `src/components/ui/Button.tsx`, `Input.tsx`, `Label.tsx`, `Card.tsx` | UI primitives |
| `tests/unit/lib/services/users.test.ts` | |
| `tests/unit/lib/auth/permissions.test.ts` | |
| `tests/integration/services/users.test.ts` | |
| `tests/e2e/auth/login.spec.ts` | |

**Dependencies:** Phases 1, 2.

---

### Phase 4 — Article CRUD + Revisions (14h)

**Goal:** Full article lifecycle. Every save creates a revision snapshot in the same transaction.

**Deliverables:**

| File | Purpose |
|---|---|
| `src/lib/validations/article.ts` | `createArticleSchema`, `updateArticleSchema` |
| `src/lib/utils/slugify.ts` | Slug from title + collision suffix |
| `src/lib/utils/markdown.ts` | `renderMarkdown()` — remark + rehype-sanitize pipeline |
| `src/lib/services/articles.ts` | `create`, `findBySlug`, `list`, `update`, `delete`, `createFromImport` |
| `src/lib/services/revisions.ts` | `createSnapshot`, `listByArticle`, `findById` |
| `src/app/api/articles/route.ts` | GET list, POST create |
| `src/app/api/articles/[slug]/route.ts` | GET, PATCH, DELETE |
| `src/app/api/articles/[slug]/revisions/route.ts` | GET list |
| `src/app/api/articles/[slug]/revisions/[id]/route.ts` | GET single |
| `src/app/(dashboard)/layout.tsx` | Sidebar + TopBar shell |
| `src/app/(dashboard)/articles/page.tsx` | Article list |
| `src/app/(dashboard)/articles/new/page.tsx` | New article |
| `src/app/(dashboard)/articles/[slug]/page.tsx` | Article view |
| `src/app/(dashboard)/articles/[slug]/edit/page.tsx` | Edit article |
| `src/app/(dashboard)/articles/[slug]/history/page.tsx` | Revision history |
| `src/app/(dashboard)/articles/[slug]/error.tsx` | Error boundary |
| `src/components/articles/ArticleCard.tsx`, `ArticleList.tsx` | |
| `src/components/articles/ArticleContent.tsx`, `ArticleMetadata.tsx` | |
| `src/components/articles/ArticleActions.tsx` | Client — edit/delete |
| `src/components/articles/RevisionList.tsx`, `RevisionRow.tsx` | |
| `src/components/editor/MarkdownEditor.tsx` | Client — wraps @uiw/react-md-editor |
| `src/components/editor/ArticleEditorForm.tsx` | Client — full form |
| `src/components/diff/DiffViewer.tsx`, `DiffOutput.tsx` | Client — diff rendering |
| `tests/unit/lib/services/articles.test.ts` | |
| `tests/unit/lib/services/revisions.test.ts` | |
| `tests/unit/lib/utils/slugify.test.ts` | |
| `tests/unit/lib/utils/markdown.test.ts` | |
| `tests/integration/services/articles.test.ts` | |
| `tests/integration/services/revisions.test.ts` | |
| `tests/e2e/articles/crud.spec.ts` | |
| `tests/e2e/articles/revisions.spec.ts` | |

**Dependencies:** Phases 1, 2, 3.

---

### Phase 5 — Tags & Categories (6h)

**Goal:** Tag and category CRUD with many-to-many article associations.

**Deliverables:** Tag Zod schemas, `src/lib/services/tags.ts`, all tag route handlers, tags page, `TagBadge`, `TagSelector`, `TagGrid`, `TagCard` components, tag unit + integration + e2e tests.

**Dependencies:** Phases 1, 2, 3.

---

### Phase 6 — Full-Text Search (6h)

**Goal:** PostgreSQL FTS with ranked results and `<mark>` excerpt highlighting.

**Deliverables:** Complete `src/lib/db/search.ts` (raw SQL), `src/lib/services/search.ts` (pagination), search route handler, search page, `SearchResults` + `SearchResultCard` Client Components, `src/hooks/useDebounce.ts`, unit (mocked raw SQL) + integration (real DB FTS) + e2e tests.

**Dependencies:** Phases 1, 2, 3, 4, 5.

---

### Phase 7 — Admin Dashboard (8h)

**Goal:** Admin panel — user list, role management, audit log view, stats.

**Deliverables:** Extend `src/lib/services/users.ts` with `list`, `changeRole`, `deactivate`; user admin route handlers; admin pages (`/admin`, `/admin/users`, `/admin/users/[id]`); `UserTable`, `RoleSelector`, `UserEditForm`, `StatsCards` components; admin unit + integration + e2e tests.

**Dependencies:** Phases 1, 2, 3.

---

### Phase 8 — MCP Import Pipeline (8h)

**Goal:** Polling-based filesystem document import with audit logging.

**Deliverables:** `src/lib/mcp/client.ts` (singleton), `src/lib/mcp/importer.ts` (full pipeline), `src/instrumentation.ts` (Next.js startup + polling), extend `articlesService.createFromImport`, `.mcp.json.example`, MCP unit tests (mocked client and service).

**Dependencies:** Phases 1, 2, 3, 4.

---

### Phase 9 — Polish & Accessibility (6h)

**Goal:** Full dark mode on all components, `data-testid` sweep, axe-core checks, responsive layout.

**Deliverables:** Audit + patch all components for `dark:` classes; add `data-testid` to all Playwright-targeted elements; add `@axe-core/playwright` checks to all e2e specs; responsive sidebar with mobile hamburger; Suspense skeleton fallbacks for article view and list; `Suspense` wrappers on slow data in Server Components.

**Dependencies:** All prior phases.

---

### Phase 10 — Coverage & CI Hardening (4h)

**Goal:** 90% coverage enforced; CI completes in ≤ 10 minutes.

**Deliverables:** Fill coverage gaps (slug collision path, FTS empty query, MCP failure path, revision numbering edge cases); parallelize CI jobs if timing exceeds budget; final `npm audit` clean pass; review and finalize `.env.example` and `src/lib/config.ts`.

**Dependencies:** All prior phases.

---

## 4. Testing Strategy

### 4.1 Unit Tests (Jest + React Testing Library)

**Location:** `tests/unit/` — mirrors `src/` directory structure.  
**Runner:** `jest --config jest.config.ts`

**Scope:**
- Service functions with Prisma mocked via `jest-mock-extended`
- Zod validation schemas (valid + invalid cases, 100% branch coverage on schemas)
- Utility functions (`slugify`, `renderMarkdown`)
- Permission helpers (`hasPermission`, `canEditArticle`)
- React components in isolation with RTL (renders, interactions, error states)

**Prisma mock pattern:**
```typescript
// tests/unit/setup.ts — runs before every test file
import { mockDeep, mockReset } from 'jest-mock-extended';
export const prismaMock = mockDeep<PrismaClient>();
jest.mock('@/lib/db/client', () => ({ db: prismaMock }));
beforeEach(() => mockReset(prismaMock));
```

**Conventions:**
- Use `describe` to group by function name; use `it` (not `test`) with natural-language sentences.
- 100% branch coverage required on all service functions and Zod schemas.
- No network calls; no filesystem access; no real DB.

---

### 4.2 Integration Tests (Jest)

**Location:** `tests/integration/`  
**Runner:** `jest --config jest.integration.config.ts`  
**Database:** `teamwiki_test` PostgreSQL (via `DATABASE_URL_TEST`)

**Setup/Teardown:**
- `globalSetup.ts` — runs `prisma migrate deploy` on test DB; creates the SYSTEM user.
- `globalTeardown.ts` — disconnects Prisma.
- `beforeEach` in each test file — calls `resetDatabase()` from `tests/integration/helpers/db.ts`.

**`resetDatabase()` deletion order (FK-safe):**
```
audit_logs → article_revisions → article_tags → articles
→ tags → categories → sessions → accounts
→ users WHERE role != SYSTEM
```

**Scope:**
- Service functions against the real schema: article + revision transaction atomicity, slug collision, tag many-to-many, FTS search query, MCP import pipeline.
- No external network calls; no MCP server calls.

---

### 4.3 End-to-End Tests (Playwright)

**Location:** `tests/e2e/`  
**Runner:** `npx playwright test`  
**Environment:** Next.js dev server via `playwright.config.ts` `webServer`, using `DATABASE_URL_TEST`

**Test structure:**
```typescript
// Every spec
test.beforeEach(async ({ page }) => {
  // seed exactly what this test needs
  await seedTestArticle({ title: 'Test', authorRole: 'EDITOR' });
  await loginAs(page, 'editor');
});
test.afterEach(async () => { await resetDatabase(); });
```

**Selector rules:**
- Always: `page.getByTestId('element-name')`
- Never: CSS class selectors, text content selectors
- Never: `page.waitForTimeout()` — use `expect(locator).toBeVisible()` with Playwright's built-in retry

**Accessibility:** Every spec file includes:
```typescript
import AxeBuilder from '@axe-core/playwright';
const results = await new AxeBuilder({ page }).analyze();
expect(results.violations).toEqual([]);
```

**Core E2E flows covered:**
- `auth/login.spec.ts` — valid login, invalid login, deactivated user
- `auth/register.spec.ts` — successful registration, duplicate email
- `articles/crud.spec.ts` — Editor creates/edits/reads article; Viewer cannot create
- `articles/revisions.spec.ts` — revision list, diff viewer, unified/split toggle
- `search/search.spec.ts` — keyword search, tag filter, empty query
- `tags/management.spec.ts` — Editor creates tag; Admin edits/deletes tag
- `admin/users.spec.ts` — Admin changes role, deactivates user; non-admin blocked

---

### 4.4 Coverage Thresholds (Enforced in CI)

```
Statements:  90%
Branches:    90%
Functions:   90%
Lines:       90%
```

Configured in `jest.config.ts` under `coverageThresholds.global`. CI fails if any metric falls below threshold.

---

## 5. Security Requirements

### 5.1 Authentication

- Passwords hashed with `bcryptjs` (work factor ≥ 12).
- Sessions are database-backed (NextAuth v5 Prisma adapter). JWT sessions are not permitted.
- `NEXTAUTH_SECRET` must be a 64-character random hex string. Rotate every 90 days.
- Session cookie: `HttpOnly`, `Secure`, `SameSite=Lax`.
- Session expiry: 2 hours (Admin), 8 hours (all others).
- Inactive users (`isActive = false`) are rejected in the `signIn` callback before a session is created.
- After role changes, the new role takes effect on the user's next request (session re-reads role from DB).

### 5.2 Authorization

- Three-layer defense: route middleware → service permission check → response scrubbing.
- Permission checks live exclusively in `src/lib/auth/permissions.ts`, called from service functions.
- Services never call `auth()` or `getServerSession()` — session is always passed as an explicit argument.
- `DRAFT` articles return 404 (not 403) for unauthorized users — prevents enumeration of draft slugs.
- Admin cannot deactivate their own account — enforced in `usersService.deactivate`.
- MCP SYSTEM account has only `article:read` and `article:create` permissions.

### 5.3 Input Validation

- Every Route Handler validates the request body with a Zod schema **before any other processing**.
- Path parameters (slugs, UUIDs) are validated and sanitized before DB queries.
- File imports via MCP: MIME type checked, extension whitelisted (`md`, `txt`, `markdown`), size ≤ 10 MB — all validated before any service call.
- All env vars validated at startup via `src/lib/config.ts` — server throws on startup if any var is invalid or missing.

### 5.4 Rate Limiting

- Basic rate limiting applied at the middleware level using an in-memory sliding window counter (acceptable for single-instance deployment).
- Limits:
  - `POST /api/auth/register`: 5 requests / 15 minutes per IP.
  - `POST /api/auth/[...nextauth]` (sign-in): 10 requests / 15 minutes per IP.
  - All other API routes: 300 requests / minute per authenticated user ID.
- Rate limit responses: `429 Too Many Requests` with `Retry-After` header.
- Implementation: `src/middleware.ts` tracks counters in a `Map` (process-scoped); acceptable for single Node.js process. **Note:** If deployed with multiple processes, move to database-backed rate limiting in a future phase.

### 5.5 CSRF Protection

- NextAuth v5 uses signed, HTTP-only cookies for CSRF protection on its own endpoints.
- Custom Route Handlers (non-NextAuth `POST`/`PATCH`/`DELETE`) are protected by:
  - Session cookie validation (any mutating request without a valid session returns 401).
  - `SameSite=Lax` cookie attribute — prevents cross-origin form submissions.
- No additional CSRF token is needed for API-style Route Handlers called with `fetch()` from the same origin, since the `Origin` header is automatically checked by browsers and the Lax cookie policy prevents cross-site cookie sending.

### 5.6 XSS Prevention

- **No `dangerouslySetInnerHTML`** anywhere in the application.
- Markdown rendering pipeline: `remark-parse → remark-gfm → remark-rehype → rehype-sanitize → rehype-stringify`. The `rehype-sanitize` package uses `defaultSchema` which allows only safe HTML elements and attributes.
- Search excerpts contain `<mark>` tags inserted by `ts_headline`. These are rendered via the same sanitized pipeline — `<mark>` is on the `defaultSchema` allowlist.
- Content Security Policy (see below) provides an additional layer against injected scripts.

### 5.7 SQL Injection Prevention

- Prisma ORM uses parameterized queries for all model operations — no user input is ever interpolated into queries.
- Raw SQL is used **only** in `src/lib/db/search.ts`. All user-controlled values are passed as `$N` parameters to `prisma.$queryRaw`. `Prisma.sql` template literals are used to ensure parameterization.
- `websearch_to_tsquery` in PostgreSQL safely parses user search input without SQL injection risk.
- Path parameters (slugs, IDs) are validated via Zod (regex + UUID format) before being passed to any query.

### 5.8 HTTP Security Headers

Set via `next.config.ts` `headers()` function, applied to all routes:

```
Content-Security-Policy:
  default-src 'self';
  script-src  'self' 'nonce-{NONCE}';
  style-src   'self' 'unsafe-inline';
  img-src     'self' data: blob:;
  font-src    'self';
  connect-src 'self';
  frame-ancestors 'none';
  base-uri    'self';
  form-action 'self';
  upgrade-insecure-requests;

Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options:    nosniff
X-Frame-Options:           DENY
Referrer-Policy:           strict-origin-when-cross-origin
Permissions-Policy:        camera=(), microphone=(), geolocation=()
```

### 5.9 Secrets & Environment Variables

- `.env` is gitignored. `.env.example` contains only placeholder values.
- `process.env` is accessed **only** in `src/lib/config.ts`. All other code imports from `config`.
- The structured logger (`src/lib/logger.ts`) redacts any field named: `password`, `passwordHash`, `token`, `secret`, `key`, `accessToken`, `refreshToken`, `idToken` at any depth.
- Stack traces and internal error messages are **never** sent to the client. Route Handlers return only `{ error: { code, message } }` for unhandled errors.

### 5.10 Dependency Security

- All dependencies are pinned to exact versions in `package.json` (no `^` or `~`).
- `npm audit --audit-level=high` runs in CI; any HIGH or CRITICAL vulnerability fails the build.
- Dependabot configured for weekly updates with PR auto-creation.

---

## 6. MCP Integration

### 6.1 Filesystem MCP Design

**Purpose:** Import existing Markdown and text documents from a designated directory into TeamWiki as draft articles, without requiring manual copy-paste.

**Constraints (non-negotiable):**
- Read-only filesystem access — MCP never writes to `IMPORT_DIR`.
- Never bypasses authentication or business logic.
- No direct database writes — always goes through `articlesService.createFromImport`.
- Never called from client-side code, Route Handlers, or request paths.
- All imported articles are created in `DRAFT` status.

### 6.2 Architecture

```
┌────────────────────────────────────────────────────────────┐
│  src/instrumentation.ts (Next.js startup hook)             │
│    register() → getMcpClient() [eager init]                │
│    setInterval(runPollingCycle, IMPORT_POLL_INTERVAL_MS)   │
└────────────────────────┬───────────────────────────────────┘
                         │ every 60s (configurable)
                         ▼
┌────────────────────────────────────────────────────────────┐
│  src/lib/mcp/client.ts — MCPFilesystemClient singleton     │
│    getMcpClient(): singleton pattern, init once            │
│    listFiles(dir): returns file metadata list              │
│    readFile(path): returns content + metadata              │
│    moveFile(src, dest): moves to failed/ on error          │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  src/lib/mcp/importer.ts — runPollingCycle()               │
│                                                            │
│  1. listFiles(IMPORT_DIR)                                  │
│  2. Filter already-processed (check audit_logs fingerprint)│
│  3. For each unprocessed file: runImportPipeline(filePath) │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  runImportPipeline(filePath)                               │
│                                                            │
│  ① readFile → raw content + { name, sizeBytes, mtime }    │
│                                                            │
│  ② Validate:                                               │
│     extension ∈ ['md', 'txt', 'markdown']                 │
│     MIME type ∈ ['text/plain', 'text/markdown']           │
│     sizeBytes ≤ 10_485_760                                 │
│     → FAIL → moveToFailed() + auditLog(FAILURE) + return  │
│                                                            │
│  ③ title = filename without extension, hyphens → spaces   │
│                                                            │
│  ④ articlesService.createFromImport({                      │
│       title, content, status: 'DRAFT',                     │
│       session: SYSTEM_SESSION   ← constant, not real user │
│     })                                                     │
│     (creates article + revision #1 in a transaction)      │
│                                                            │
│  ⑤ auditLog(MCP_IMPORT_SUCCESS, {                          │
│       fileName, sizeBytes, importedAt, articleId           │
│     })                                                     │
│                                                            │
│  ⑥ catch any error:                                        │
│     logger.error(...); moveToFailed(); auditLog(FAILURE)  │
│     ← original file NEVER deleted                         │
└────────────────────────────────────────────────────────────┘
```

### 6.3 MCP Configuration

**`.mcp.json`** (gitignored — set per environment):
```json
{
  "filesystem": {
    "rootDir": "/data/teamwiki-imports"
  }
}
```

**`.mcp.json.example`** (committed — documents structure):
```json
{
  "filesystem": {
    "rootDir": "/path/to/your/import/directory"
  }
}
```

### 6.4 Deduplication / Fingerprinting

Before processing a file, `importer.ts` queries:
```sql
SELECT id FROM audit_logs
WHERE event_type IN ('MCP_IMPORT_SUCCESS', 'MCP_IMPORT_FAILURE')
  AND metadata->>'fileName' = $1
  AND metadata->>'sizeBytes' = $2
```
If a matching record exists, the file is skipped. This prevents re-processing on each poll cycle.

### 6.5 `IMPORT_DIR` Directory Layout

```
IMPORT_DIR/
├── document-one.md          ← awaiting import
├── document-two.txt         ← awaiting import
└── failed/
    └── bad-file.pdf         ← moved here after validation failure
```

### 6.6 SYSTEM User

The SYSTEM user is created in `prisma/seed.ts` with a fixed known UUID (constant in `src/lib/mcp/importer.ts`). It has role `SYSTEM`, `isActive = true`, and a non-guessable email (`system@teamwiki.internal`). It cannot log in (no password hash). All MCP-imported articles are attributed to this user.

---

## 7. CI/CD Pipeline

### 7.1 Build & Test Pipeline (`ci.yml`)

**Trigger:** Every push to any branch; every PR targeting `main`.  
**Timeout:** 10 minutes (hard limit — investigate parallelization before increasing).

```yaml
jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_DB: teamwiki_test, POSTGRES_USER: teamwiki, POSTGRES_PASSWORD: ${{ secrets.TEST_DB_PASSWORD }} }
        options: --health-cmd pg_isready --health-interval 10s --health-retries 5

    steps:
      1.  actions/checkout@v4
      2.  actions/setup-node@v4 (Node 20, npm cache)
      3.  npm ci                              ← exact-version install
      4.  tsc --noEmit                        ← type check
      5.  eslint src tests --max-warnings 0  ← lint
      6.  prettier --check "src/**/*.{ts,tsx}" "tests/**/*.{ts,tsx}"
      7.  npm audit --audit-level=high        ← security scan
      8.  prisma generate
      9.  prisma migrate deploy               ← apply to test DB
      10. jest --config jest.config.ts --coverage --ci
      11. jest --config jest.integration.config.ts --ci
      12. next build                          ← production build verification
```

### 7.2 Security Scan

- `npm audit --audit-level=high` runs as step 7 in `ci.yml`.
- Any HIGH or CRITICAL vulnerability causes immediate CI failure.
- Dependabot creates weekly PRs for dependency updates; these go through the full CI pipeline before merge.
- Secrets are stored in GitHub Actions encrypted secrets; **never** hardcoded in workflow YAML.

### 7.3 E2E Pipeline (`e2e.yml`)

**Trigger:** Every PR targeting `main`; every push to `main`.  
**Timeout:** 15 minutes.

```yaml
steps:
  1-5. checkout, setup-node, npm ci, prisma generate, prisma migrate deploy + seed
  6.   playwright install --with-deps chromium
  7.   playwright test
  8.   upload playwright-report/ artifact (on failure only)
```

### 7.4 Environment Promotion

```
feat/* branch
  │  PR opened
  ▼
CI pipeline (ci.yml) — all 12 steps must pass
  │  1 approval required
  ▼
Squash-merge to main (linear history enforced)
  │
  ▼
CI re-runs on main
E2E pipeline runs
  │  both pass
  ▼
Auto-deploy to STAGING environment
  prisma migrate deploy (automatic)
  Smoke tests run against staging URL
  │  manual approval gate (GitHub Actions "production" environment)
  ▼
Deploy to PRODUCTION
  prisma migrate deploy
  GitHub Release created (auto-generated changelog from conventional commits)

─────────────────────────────────────
Rollback procedure:
  1. Create a revert PR: git revert <merge-commit>
  2. PR goes through standard CI pipeline
  3. Merge → auto-deploy to staging → manual approve → production
  NEVER force-push to main or any protected branch.
```

### 7.5 Branch Protection Rules

Configured on `main`:
- Require PR before merging.
- Require at least 1 approving review.
- Require CI status checks to pass: `ci / Lint, Type-check, Test, Build`.
- Require branches to be up to date before merging.
- No direct pushes.
- No force pushes.
- Squash merge only.

---

## 8. Scope Boundaries

The following are **explicitly not included** in TeamWiki v1.0. Any request to implement these requires a separate specification and explicit user approval.

| Item | Reason Excluded |
|---|---|
| Real-time collaboration (WebSockets, CRDTs) | Architecture complexity out of scope for v1.0 |
| Email notifications (password reset, @mention) | External email service dependency excluded |
| External search engines (Elasticsearch, Algolia) | PostgreSQL FTS is sufficient; external service adds operational overhead |
| Multi-tenancy (multiple organizations) | Single-tenant design; schema and auth model are not multi-tenant |
| Mobile applications (iOS, Android, React Native) | Web only |
| AI-generated article suggestions or summarization | AI/LLM integration not in scope |
| S3, Azure Blob, or other external object storage | Local filesystem only; MCP reads from a mounted directory |
| File attachments within articles (images, PDFs) | Not in scope; Markdown editor supports external image URLs only |
| OAuth / social login (Google, GitHub) | NextAuth `Account` model is reserved for future use; not implemented in v1.0 |
| Redis or distributed caching | Single-process architecture; no shared in-memory state |
| Audit log admin UI | Audit logs are written and queryable but no UI is built in v1.0 |
| Article comments or discussion threads | Not in scope |
| Export to PDF or Word | Not in scope |
| Webhooks for external integrations | Not in scope |
| Internationalization (i18n) | English only in v1.0 |
| Full offline support (PWA, service worker) | Not in scope |
| Rate limiting at infrastructure level (WAF, API gateway) | Application-level rate limiting only in v1.0 |

---

## 9. Success Criteria

TeamWiki v1.0 is considered complete when **all** of the following are true.

### 9.1 Feature Completeness

- [ ] All user stories in Section 1 pass their acceptance criteria.
- [ ] All three roles (Viewer, Editor, Admin) are functional end-to-end.
- [ ] The MCP import pipeline processes `.md`, `.txt`, and `.markdown` files correctly.
- [ ] Revision history and diff viewer work for all articles.
- [ ] Full-text search returns ranked, highlighted results.
- [ ] Admin dashboard shows accurate user and article statistics.

### 9.2 Code Quality

- [ ] `tsc --noEmit` completes with zero errors.
- [ ] `eslint src tests --max-warnings 0` passes with zero warnings.
- [ ] `prettier --check` passes with no formatting issues.
- [ ] No `any`, `@ts-ignore`, `eslint-disable`, or `TODO` comments in committed code.
- [ ] No co-located `*.test.ts` files — all tests are under `tests/`.
- [ ] No barrel `index.ts` files.

### 9.3 Test Coverage

- [ ] All unit test suites pass.
- [ ] All integration test suites pass against `teamwiki_test` PostgreSQL.
- [ ] All Playwright e2e specs pass.
- [ ] Coverage thresholds enforced in CI at **90%** (statements, branches, functions, lines).
- [ ] All Playwright specs include an `axe-core` accessibility check with zero violations.

### 9.4 Security

- [ ] `npm audit --audit-level=high` reports no HIGH or CRITICAL vulnerabilities.
- [ ] All six HTTP security headers are present on all responses (verified via `curl -I`).
- [ ] No secrets, credentials, or real paths appear in any committed file.
- [ ] Markdown rendering produces no XSS vulnerabilities (verified via axe-core + manual test of `<script>` injection in article content).
- [ ] DRAFT article slugs are not enumerable by Viewers (404 returned, not 403).
- [ ] Permission checks verified for all three roles on all API endpoints.

### 9.5 Performance

- [ ] CI pipeline completes in ≤ 10 minutes (unit + integration + build).
- [ ] `next build` succeeds with no build errors or warnings.
- [ ] Article list page loads within 2 seconds on a cold server (Server Component render).
- [ ] Full-text search returns results within 500 ms for a 10,000-article dataset (verified via integration test with seeded data).

### 9.6 Process

- [ ] All commits follow Conventional Commits format.
- [ ] All PRs reference a GitHub issue.
- [ ] All branches follow `type/description` naming.
- [ ] GitHub branch protection rules are configured on `main`.
- [ ] Dependabot is active and producing weekly PRs.
- [ ] `.env.example` documents every environment variable required to run the application.
- [ ] `prisma/seed.ts` produces a usable development environment with all three roles represented.
