import { z } from 'zod';

export const createTagSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Tag name too long'),
  categoryId: z.string().uuid().optional(),
});

export const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  categoryId: z.string().uuid().nullable().optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Category name too long'),
  description: z.string().max(500).optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  tags: z
    .string()
    .transform((v) => v.split(',').filter(Boolean))
    .optional()
    .default(''),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
