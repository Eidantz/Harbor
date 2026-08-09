FROM oven/bun:1.3-debian AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mcp/package.json apps/mcp/
RUN bun install --frozen-lockfile --filter @kanban/api

FROM base AS build
COPY --from=deps /app /app
COPY apps/api apps/api
WORKDIR /app/apps/api
RUN bunx prisma generate && bun run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh

RUN chmod +x ./apps/api/docker-entrypoint.sh \
  && cd apps/api && bunx prisma generate

WORKDIR /app/apps/api
EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["bun", "run", "dist/main.js"]
