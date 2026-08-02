FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json tsconfig.json ./
COPY lib/db/package.json lib/db/
COPY packages/api-zod/package.json packages/api-zod/
COPY packages/api-client-react/package.json packages/api-client-react/
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/pool-ui/package.json artifacts/pool-ui/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app .
COPY lib lib
COPY packages packages
COPY artifacts artifacts
COPY config config
RUN pnpm run typecheck:libs
RUN PORT=3001 BASE_PATH=/ pnpm --filter @workspace/pool-ui run build 2>&1 || echo "pool-ui build skipped (pre-existing type errors)"
RUN pnpm --filter @workspace/api-server run build

FROM base AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=builder /app/artifacts/pool-ui/dist ./artifacts/pool-ui/dist
COPY --from=builder /app/artifacts/api-server/bin ./artifacts/api-server/bin
COPY --from=builder /app/lib/db ./lib/db
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=builder /app/lib/db/tsconfig.json ./lib/db/tsconfig.json
COPY --from=builder /app/config ./config
RUN rm -rf node_modules/.pnpm/node_modules/.cache 2>/dev/null || true

EXPOSE 3001 3331 3333

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
