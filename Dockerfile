# syntax=docker/dockerfile:1

# Production image, built by CI. The same image runs the app (default command)
# and one-off migrations (node scripts/migrate.mjs).

FROM node:24-alpine AS base
WORKDIR /app
# pnpm version comes from "packageManager" in package.json
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# src/db requires DATABASE_URL at import time; the build never connects, so a placeholder is enough.
RUN DATABASE_URL=postgresql://build@localhost/build pnpm build
# scripts/migrate.mjs runs outside the Next.js bundle, so it needs complete copies of its packages.
RUN mkdir -p .next/standalone/node_modules && \
    for pkg in drizzle-orm postgres; do \
      rm -rf ".next/standalone/node_modules/$pkg" && \
      cp -rL "node_modules/$pkg" ".next/standalone/node_modules/$pkg"; \
    done

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/scripts/migrate.mjs ./scripts/migrate.mjs
USER node
EXPOSE 3000
CMD ["node", "server.js"]
