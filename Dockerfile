FROM --platform=linux/amd64 node:24-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
FROM --platform=linux/amd64 node:24-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Provide dummy DATABASE_URL for Next.js build-time page collection.
# The actual value is injected at runtime via environment variables.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build

RUN npm run build

# Turbopack standalone output does not include the instrumentation hook or its
# chunk dependencies. Copy them from the full build into the standalone tree.
RUN set -e; \
    BASE=$(dirname "$(find .next/standalone -name server.js -maxdepth 3 | head -1)"); \
    cp .next/server/instrumentation.js "$BASE/.next/server/"; \
    cp -r .next/server/instrumentation "$BASE/.next/server/"; \
    cp .next/server/chunks/*.js "$BASE/.next/server/chunks/"; \
    for f in .next/node_modules/*; do \
      if [ -L "$f" ]; then \
        cp -rL "$f" "$BASE/.next/node_modules/$(basename "$f")"; \
      fi; \
    done

RUN npx tsc --project tsconfig.typeorm.json

# ---------------------------------------------------------------------------
FROM --platform=linux/amd64 node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Public assets
COPY --from=builder /app/public ./public

# Standalone server
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Compiled migration runner and migrations
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist

# Entrypoint script
COPY --from=builder --chown=nextjs:nodejs /app/scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=40s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
