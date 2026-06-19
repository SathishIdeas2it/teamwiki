import type { Role, ArticleStatus, AuditEventType } from '@prisma/client';

// ─── Session ──────────────────────────────────────────────────────────────────

export type AppSession = {
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
  };
  expires: string;
};

// ─── Users ────────────────────────────────────────────────────────────────────

export type UserSummary = {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
};

// ─── Articles ─────────────────────────────────────────────────────────────────

export type ArticleSummary = {
  id: string;
  slug: string;
  title: string;
  status: ArticleStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string };
  tags: TagSummary[];
};

export type ArticleWithDetails = ArticleSummary & {
  content: string;
  revisionCount: number;
};

// ─── Revisions ────────────────────────────────────────────────────────────────

export type RevisionSummary = {
  id: string;
  revisionNumber: number;
  authorName: string;
  changeSummary: string | null;
  createdAt: Date;
};

export type RevisionDetail = RevisionSummary & {
  title: string;
  content: string;
};

// ─── Tags ─────────────────────────────────────────────────────────────────────

export type TagSummary = {
  id: string;
  name: string;
  slug: string;
};

export type TagWithCategory = TagSummary & {
  category: { id: string; name: string; slug: string } | null;
  articleCount: number;
};

// ─── Search ───────────────────────────────────────────────────────────────────

export type SearchResult = {
  id: string;
  slug: string;
  title: string;
  authorName: string;
  publishedAt: Date | null;
  rank: number;
  excerpt: string;
};

// ─── Audit ────────────────────────────────────────────────────────────────────

export type AuditLogEntry = {
  id: string;
  eventType: AuditEventType;
  actorId: string | null;
  targetId: string | null;
  targetType: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

// ─── Pagination ───────────────────────────────────────────────────────────────

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type PaginatedResult<T> = {
  data: T[];
  meta: PaginationMeta;
};

// ─── API Responses ────────────────────────────────────────────────────────────

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

// ─── MCP ──────────────────────────────────────────────────────────────────────

export type McpFileMetadata = {
  name: string;
  path: string;
  sizeBytes: number;
  mtime: string;
  extension: string;
};

// ─── Stats ────────────────────────────────────────────────────────────────────

export type DashboardStats = {
  totalArticles: number;
  publishedArticles: number;
  draftArticles: number;
  totalUsers: number;
  usersByRole: Record<Role, number>;
  articlesThisMonth: number;
  recentImports: number;
};
