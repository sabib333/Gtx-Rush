# ============================================================
# GTX Rush — Production Dockerfile
# Multi-stage build for minimal production image
# ============================================================

# --- Stage 1: Dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy dependency files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/validation/package.json ./packages/validation/
COPY packages/analytics/package.json ./packages/analytics/
COPY packages/telegram/package.json ./packages/telegram/
COPY packages/game-engine/package.json ./packages/game-engine/

# Install dependencies (no dev dependencies in production)
RUN pnpm install --frozen-lockfile --prod

# --- Stage 2: Build ---
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy source and dependency files
COPY . .

# Install all dependencies (including dev)
RUN pnpm install --frozen-lockfile

# Build packages
RUN pnpm --filter @gtx-rush/config build
RUN pnpm --filter @gtx-rush/types build
RUN pnpm --filter @gtx-rush/validation build

# Build API
RUN pnpm --filter @gtx-rush/api build

# --- Stage 3: Production ---
FROM node:20-alpine AS production
WORKDIR /app

# Security: Run as non-root user
RUN addgroup -g 1001 -S gtxrush && \
    adduser -S gtxrush -u 1001 -G gtxrush

# Install pnpm for production install
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy dependency files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/validation/package.json ./packages/validation/
COPY packages/analytics/package.json ./packages/analytics/
COPY packages/telegram/package.json ./packages/telegram/
COPY packages/game-engine/package.json ./packages/game-engine/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files from builder stage
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/validation/dist ./packages/validation/dist
COPY --from=builder /app/packages/analytics/dist ./packages/analytics/dist
COPY --from=builder /app/packages/telegram/dist ./packages/telegram/dist
COPY --from=builder /app/packages/game-engine/dist ./packages/game-engine/dist

# Copy drizzle config and migrations
COPY apps/api/drizzle.config.ts ./apps/api/
COPY apps/api/src/db/migrations ./apps/api/src/db/migrations

# Set ownership to non-root user
RUN chown -R gtxrush:gtxrush /app

# Switch to non-root user
USER gtxrush

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Expose port
EXPOSE 3001

# Set Node.js options
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=768"

# Start the application
CMD ["node", "apps/api/dist/index.js"]
