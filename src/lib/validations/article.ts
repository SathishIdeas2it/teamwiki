import { z } from 'zod';
import { ArticleStatus } from '@prisma/client';

export const createArticleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  content: z.string().min(1, 'Content is required'),
  tagIds: z.array(z.string().uuid()).default([]),
  status: z.nativeEnum(ArticleStatus).optional().default(ArticleStatus.DRAFT),
  changeSummary: z.string().max(500).optional(),
});

export const updateArticleSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  status: z.nativeEnum(ArticleStatus).optional(),
  changeSummary: z.string().max(500).optional(),
});

export const articleListQuerySchema = z.object({
  status: z.nativeEnum(ArticleStatus).optional(),
  authorId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
export type ArticleListQuery = z.infer<typeof articleListQuerySchema>;
