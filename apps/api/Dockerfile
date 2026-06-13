# Vertxing — Real-Time Video Meeting Platform
# ─────────────────────────────────────────────────────────────────────────────
# File:    apps/api/Dockerfile
# Layer:   Deployment (container image for the API)
# Purpose: A self-contained production image for the NestJS API. It builds the
#          shared package, generates the Prisma client, and builds the API; on
#          start it runs `prisma migrate deploy` (so a fresh database is set up
#          automatically) and launches the server. Build context is the REPO
#          ROOT (the API depends on the @vertxing/shared workspace).
#          Works on Render (Docker), Fly.io, Railway, or any VM with Docker.
#
#          Build (from repo root):  docker build -f apps/api/Dockerfile -t vertxing-api .
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

# OpenSSL is required by Prisma's query engine on debian-slim.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# 1) Install workspace deps (cached unless a manifest changes). Every workspace's
#    package.json must be present for `npm ci` to resolve the workspace graph.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

# 2) Copy only what the API needs (the web app is excluded via .dockerignore).
#    The root tsconfig.base.json is extended by both workspaces — without it tsc
#    silently falls back to ES3 defaults and the build fails.
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

# 3) Build shared → generate Prisma client → build API.
RUN npm run build:shared \
    && npx prisma generate --schema apps/api/prisma/schema.prisma \
    && npm run build:api

ENV NODE_ENV=production

# Local default; hosts (Render/Fly) inject PORT and the app honours it.
EXPOSE 4000

# Apply any pending migrations against the live DB, then start.
CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/main.js"]
