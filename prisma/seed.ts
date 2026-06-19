import { PrismaClient, Role, ArticleStatus } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding database…');

  // ─── System User ─────────────────────────────────────────────────────────────
  // The SYSTEM account is used by the MCP import pipeline. It has no password.
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

  // ─── Human Users ─────────────────────────────────────────────────────────────
  const adminHash = await bcryptjs.hash('Admin@TeamWiki1', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@teamwiki.internal' },
    update: {},
    create: {
      email: 'admin@teamwiki.internal',
      name: 'Admin User',
      role: Role.ADMIN,
      passwordHash: adminHash,
      isActive: true,
    },
  });

  const editorHash = await bcryptjs.hash('Editor@TeamWiki1', 12);
  const editorUser = await prisma.user.upsert({
    where: { email: 'editor@teamwiki.internal' },
    update: {},
    create: {
      email: 'editor@teamwiki.internal',
      name: 'Editor User',
      role: Role.EDITOR,
      passwordHash: editorHash,
      isActive: true,
    },
  });

  const viewerHash = await bcryptjs.hash('Viewer@TeamWiki1', 12);
  await prisma.user.upsert({
    where: { email: 'viewer@teamwiki.internal' },
    update: {},
    create: {
      email: 'viewer@teamwiki.internal',
      name: 'Viewer User',
      role: Role.VIEWER,
      passwordHash: viewerHash,
      isActive: true,
    },
  });

  // ─── Categories ──────────────────────────────────────────────────────────────
  const engineeringCat = await prisma.category.upsert({
    where: { slug: 'engineering' },
    update: {},
    create: { name: 'Engineering', slug: 'engineering', description: 'Software engineering topics' },
  });

  const processCat = await prisma.category.upsert({
    where: { slug: 'process' },
    update: {},
    create: { name: 'Process', slug: 'process', description: 'Team processes and procedures' },
  });

  // ─── Tags ────────────────────────────────────────────────────────────────────
  const backendTag = await prisma.tag.upsert({
    where: { slug: 'backend' },
    update: {},
    create: { name: 'Backend', slug: 'backend', categoryId: engineeringCat.id },
  });

  const frontendTag = await prisma.tag.upsert({
    where: { slug: 'frontend' },
    update: {},
    create: { name: 'Frontend', slug: 'frontend', categoryId: engineeringCat.id },
  });

  await prisma.tag.upsert({
    where: { slug: 'onboarding' },
    update: {},
    create: { name: 'Onboarding', slug: 'onboarding', categoryId: processCat.id },
  });

  // ─── Articles + Revision snapshots ───────────────────────────────────────────
  // Each article create is paired with revision #1 inside a transaction so the
  // pair is always consistent and idempotent across re-seeds.

  const article1 = await prisma.article.upsert({
    where: { slug: 'getting-started' },
    update: {},
    create: {
      slug: 'getting-started',
      title: 'Getting Started with TeamWiki',
      content:
        '# Getting Started\n\nWelcome to TeamWiki! This guide will help you get up and running quickly.\n\n' +
        '## Creating Your First Article\n\nClick the **New Article** button in the sidebar to begin.',
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
      content:
        '# API Design Guidelines\n\nFollow these guidelines when designing REST APIs for TeamWiki.\n\n' +
        '## Versioning\n\nAll APIs are versioned via the URL path (`/api/v1/...`).\n\n' +
        '## Error Format\n\nAll errors return `{ error: { code, message } }`.',
      status: ArticleStatus.PUBLISHED,
      authorId: editorUser.id,
      publishedAt: new Date(),
      tags: { create: [{ tagId: backendTag.id }] },
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
      content:
        '# Frontend Conventions\n\nOur React and TypeScript coding conventions for TeamWiki.\n\n' +
        '## Component Naming\n\nAll components use PascalCase. Files are named after the component.',
      status: ArticleStatus.DRAFT,
      authorId: editorUser.id,
      tags: { create: [{ tagId: frontendTag.id }] },
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
  console.log(`  system : ${systemUser.email}`);
  console.log(`  admin  : ${adminUser.email}   / Admin@TeamWiki1`);
  console.log(`  editor : ${editorUser.email}  / Editor@TeamWiki1`);
  console.log(`  viewer : viewer@teamwiki.internal / Viewer@TeamWiki1`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
