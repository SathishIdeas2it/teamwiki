import { PrismaClient, Role, ArticleStatus } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding database...');

  // ─── System User ────────────────────────────────────────────────────────────
  const systemUser = await prisma.user.upsert({
    where: { email: 'system@teamwiki.internal' },
    update: {},
    create: {
      email: 'system@teamwiki.internal',
      name: 'System',
      role: Role.SYSTEM,
      isActive: true,
    },
  });

  // ─── Admin User ─────────────────────────────────────────────────────────────
  const adminPassword = await bcryptjs.hash('Admin@TeamWiki1', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@teamwiki.internal' },
    update: {},
    create: {
      email: 'admin@teamwiki.internal',
      name: 'Admin User',
      role: Role.ADMIN,
      passwordHash: adminPassword,
      isActive: true,
    },
  });

  // ─── Editor User ─────────────────────────────────────────────────────────────
  const editorPassword = await bcryptjs.hash('Editor@TeamWiki1', 12);
  const editorUser = await prisma.user.upsert({
    where: { email: 'editor@teamwiki.internal' },
    update: {},
    create: {
      email: 'editor@teamwiki.internal',
      name: 'Editor User',
      role: Role.EDITOR,
      passwordHash: editorPassword,
      isActive: true,
    },
  });

  // ─── Viewer User ─────────────────────────────────────────────────────────────
  const viewerPassword = await bcryptjs.hash('Viewer@TeamWiki1', 12);
  await prisma.user.upsert({
    where: { email: 'viewer@teamwiki.internal' },
    update: {},
    create: {
      email: 'viewer@teamwiki.internal',
      name: 'Viewer User',
      role: Role.VIEWER,
      passwordHash: viewerPassword,
      isActive: true,
    },
  });

  // ─── Categories ──────────────────────────────────────────────────────────────
  const engineeringCategory = await prisma.category.upsert({
    where: { slug: 'engineering' },
    update: {},
    create: {
      name: 'Engineering',
      slug: 'engineering',
      description: 'Software engineering topics',
    },
  });

  const processCategory = await prisma.category.upsert({
    where: { slug: 'process' },
    update: {},
    create: {
      name: 'Process',
      slug: 'process',
      description: 'Team processes and procedures',
    },
  });

  // ─── Tags ────────────────────────────────────────────────────────────────────
  const backendTag = await prisma.tag.upsert({
    where: { slug: 'backend' },
    update: {},
    create: { name: 'Backend', slug: 'backend', categoryId: engineeringCategory.id },
  });

  const frontendTag = await prisma.tag.upsert({
    where: { slug: 'frontend' },
    update: {},
    create: { name: 'Frontend', slug: 'frontend', categoryId: engineeringCategory.id },
  });

  await prisma.tag.upsert({
    where: { slug: 'onboarding' },
    update: {},
    create: { name: 'Onboarding', slug: 'onboarding', categoryId: processCategory.id },
  });

  // ─── Articles with Revisions ─────────────────────────────────────────────────
  const article1 = await prisma.article.upsert({
    where: { slug: 'getting-started' },
    update: {},
    create: {
      slug: 'getting-started',
      title: 'Getting Started with TeamWiki',
      content: '# Getting Started\n\nWelcome to TeamWiki! This guide will help you get up and running.',
      status: ArticleStatus.PUBLISHED,
      authorId: adminUser.id,
      publishedAt: new Date(),
    },
  });

  await prisma.articleRevision.upsert({
    where: { articleId_revisionNumber: { articleId: article1.id, revisionNumber: 1 } },
    update: {},
    create: {
      articleId: article1.id,
      revisionNumber: 1,
      title: article1.title,
      content: article1.content,
      authorId: adminUser.id,
      changeSummary: 'Initial version',
    },
  });

  const article2 = await prisma.article.upsert({
    where: { slug: 'api-design-guidelines' },
    update: {},
    create: {
      slug: 'api-design-guidelines',
      title: 'API Design Guidelines',
      content: '# API Design Guidelines\n\nFollow these guidelines when designing REST APIs.',
      status: ArticleStatus.PUBLISHED,
      authorId: editorUser.id,
      publishedAt: new Date(),
      tags: {
        create: [{ tagId: backendTag.id }],
      },
    },
  });

  await prisma.articleRevision.upsert({
    where: { articleId_revisionNumber: { articleId: article2.id, revisionNumber: 1 } },
    update: {},
    create: {
      articleId: article2.id,
      revisionNumber: 1,
      title: article2.title,
      content: article2.content,
      authorId: editorUser.id,
      changeSummary: 'Initial version',
    },
  });

  const article3 = await prisma.article.upsert({
    where: { slug: 'frontend-conventions' },
    update: {},
    create: {
      slug: 'frontend-conventions',
      title: 'Frontend Conventions',
      content: '# Frontend Conventions\n\nOur React and TypeScript coding conventions.',
      status: ArticleStatus.DRAFT,
      authorId: editorUser.id,
      tags: {
        create: [{ tagId: frontendTag.id }],
      },
    },
  });

  await prisma.articleRevision.upsert({
    where: { articleId_revisionNumber: { articleId: article3.id, revisionNumber: 1 } },
    update: {},
    create: {
      articleId: article3.id,
      revisionNumber: 1,
      title: article3.title,
      content: article3.content,
      authorId: editorUser.id,
      changeSummary: 'Initial draft',
    },
  });

  console.log('Seed complete.');
  console.log(`  System user: ${systemUser.email}`);
  console.log(`  Admin:       ${adminUser.email}  / Admin@TeamWiki1`);
  console.log(`  Editor:      ${editorUser.email} / Editor@TeamWiki1`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
