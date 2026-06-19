-- CreateEnum
CREATE TYPE "Role" AS ENUM ('VIEWER', 'EDITOR', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM (
  'ARTICLE_CREATED',
  'ARTICLE_UPDATED',
  'ARTICLE_DELETED',
  'MCP_IMPORT_SUCCESS',
  'MCP_IMPORT_FAILURE',
  'USER_ROLE_CHANGED',
  'USER_DEACTIVATED'
);

-- CreateTable: users
CREATE TABLE "users" (
    "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
    "email"         VARCHAR(254)  NOT NULL,
    "name"          VARCHAR(100)  NOT NULL,
    "password_hash" TEXT,
    "role"          "Role"        NOT NULL DEFAULT 'VIEWER',
    "is_active"     BOOLEAN       NOT NULL DEFAULT true,
    "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMPTZ(6) NOT NULL,
    "deleted_at"    TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateTable: accounts (NextAuth OAuth)
CREATE TABLE "accounts" (
    "id"                  UUID  NOT NULL DEFAULT gen_random_uuid(),
    "user_id"             UUID  NOT NULL,
    "type"                TEXT  NOT NULL,
    "provider"            TEXT  NOT NULL,
    "provider_account_id" TEXT  NOT NULL,
    "refresh_token"       TEXT,
    "access_token"        TEXT,
    "expires_at"          BIGINT,
    "token_type"          TEXT,
    "scope"               TEXT,
    "id_token"            TEXT,
    "session_state"       TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateTable: sessions (NextAuth database sessions)
CREATE TABLE "sessions" (
    "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
    "session_token" TEXT          NOT NULL,
    "user_id"       UUID          NOT NULL,
    "expires"       TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateTable: verification_tokens
CREATE TABLE "verification_tokens" (
    "identifier" TEXT          NOT NULL,
    "token"      TEXT          NOT NULL,
    "expires"    TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("identifier", "token")
);

CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateTable: categories
CREATE TABLE "categories" (
    "id"          UUID          NOT NULL DEFAULT gen_random_uuid(),
    "name"        VARCHAR(100)  NOT NULL,
    "slug"        VARCHAR(100)  NOT NULL,
    "description" TEXT,
    "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateTable: tags
CREATE TABLE "tags" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "name"        VARCHAR(50)  NOT NULL,
    "slug"        VARCHAR(50)  NOT NULL,
    "category_id" UUID,
    "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");
CREATE INDEX "tags_category_id_idx" ON "tags"("category_id");

-- CreateTable: articles
CREATE TABLE "articles" (
    "id"           UUID             NOT NULL DEFAULT gen_random_uuid(),
    "slug"         VARCHAR(255)     NOT NULL,
    "title"        VARCHAR(500)     NOT NULL,
    "content"      TEXT             NOT NULL,
    "status"       "ArticleStatus"  NOT NULL DEFAULT 'DRAFT',
    "author_id"    UUID             NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "created_at"   TIMESTAMPTZ(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMPTZ(6)   NOT NULL,
    "deleted_at"   TIMESTAMPTZ(6),
    -- search_vector is maintained entirely by the trigger below; never written by Prisma
    "search_vector" tsvector,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");
CREATE INDEX "articles_author_id_idx" ON "articles"("author_id");
CREATE INDEX "articles_status_idx" ON "articles"("status");
CREATE INDEX "articles_published_at_idx" ON "articles"("published_at" DESC);
CREATE INDEX "articles_deleted_at_idx" ON "articles"("deleted_at");
-- GIN index enables fast full-text search on search_vector
CREATE INDEX "articles_search_vector_idx" ON "articles" USING GIN("search_vector");

-- CreateTable: article_tags (join)
CREATE TABLE "article_tags" (
    "article_id" UUID NOT NULL,
    "tag_id"     UUID NOT NULL,

    CONSTRAINT "article_tags_pkey" PRIMARY KEY ("article_id", "tag_id")
);

-- CreateTable: article_revisions
CREATE TABLE "article_revisions" (
    "id"              UUID          NOT NULL DEFAULT gen_random_uuid(),
    "article_id"      UUID          NOT NULL,
    "revision_number" INTEGER       NOT NULL,
    "title"           VARCHAR(500)  NOT NULL,
    "content"         TEXT          NOT NULL,
    "author_id"       UUID          NOT NULL,
    "change_summary"  TEXT,
    "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "article_revisions_article_id_revision_number_key"
    ON "article_revisions"("article_id", "revision_number");
CREATE INDEX "article_revisions_article_id_revision_number_idx"
    ON "article_revisions"("article_id", "revision_number" DESC);

-- CreateTable: audit_logs
CREATE TABLE "audit_logs" (
    "id"          UUID             NOT NULL DEFAULT gen_random_uuid(),
    "event_type"  "AuditEventType" NOT NULL,
    "actor_id"    UUID,
    "target_id"   UUID,
    "target_type" VARCHAR(50),
    "metadata"    JSONB,
    "created_at"  TIMESTAMPTZ(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- AddForeignKey: accounts → users
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: sessions → users
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: tags → categories
ALTER TABLE "tags" ADD CONSTRAINT "tags_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: articles → users
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: article_tags → articles
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_article_id_fkey"
    FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: article_tags → tags
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_tag_id_fkey"
    FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: article_revisions → articles
ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_article_id_fkey"
    FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: article_revisions → users
ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: audit_logs → users (SET NULL preserves audit trail when user is deleted)
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- FTS trigger function: maintains search_vector on insert/update of title or content.
-- Weight A = title (highest relevance), Weight B = content.
-- websearch_to_tsquery in queries safely handles user input; tsvector is pre-computed here.
CREATE OR REPLACE FUNCTION articles_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_search_vector_update
BEFORE INSERT OR UPDATE OF title, content ON articles
FOR EACH ROW EXECUTE FUNCTION articles_search_vector_update();
