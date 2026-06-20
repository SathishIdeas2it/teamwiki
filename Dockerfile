# syntax=docker/dockerfile:1.7

# ─── Stage 1: Production dependencies ─────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
# Install only production deps so the runner stage stays lean
RUN npm ci --omit=dev --ignore-scripts

# ─── Stage 2: Full dependencies (needed for build tools / ts-node / prisma) ───
FROM node:20-alpine AS build-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ─── Stage 3: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY --from=build-deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client from schema — no live DB connection needed here.
# Use a placeholder URL; the real one is injected at container start.
ARG DATABASE_URL=postgresql://noop:noop@localhost:5432/noop
ENV DATABASE_URL=${DATABASE_URL}
RUN npx prisma generate

# next build reads these vars via src/lib/config.ts; placeholders are fine
# because RSC pages using auth() are automatically dynamic (no static pre-render).
ARG NEXTAUTH_SECRET=ci-placeholder-secret-that-is-at-least-32-characters
ARG NEXTAUTH_URL=http://localhost:3000
ARG IMPORT_DIR=/app/imports
ARG IMPORT_POLL_INTERVAL_MS=60000

ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}
ENV IMPORT_DIR=${IMPORT_DIR}
ENV IMPORT_POLL_INTERVAL_MS=${IMPORT_POLL_INTERVAL_MS}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ─── Stage 4: Production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
# wget is used by the HEALTHCHECK
RUN apk add --no-cache wget

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run as non-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Public static assets
COPY --from=builder /app/public ./public

# Standalone Next.js server (output: 'standalone' in next.config.ts)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static

# Prisma schema and generated client needed for migrations at startup
COPY --from=builder --chown=nextjs:nodejs /app/prisma            ./prisma
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# MCP import directory
RUN mkdir -p /app/imports/failed && chown -R nextjs:nodejs /app/imports

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
