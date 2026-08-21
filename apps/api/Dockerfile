# Production image for the LastMile API (Bun + Hono).
# Build from the repo root so workspace deps resolve:
#   docker build -f apps/api/Dockerfile -t lastmile-api .
FROM oven/bun:1.4.0 AS base
WORKDIR /app

# Install workspace dependencies first (layer-cached)
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN bun install --frozen-lockfile --production

# Source + migrations
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

WORKDIR /app/apps/api
EXPOSE 4000
ENV NODE_ENV=production

# Apply migrations, then serve.
CMD ["sh", "-c", "bun run src/db/migrate.ts && bun run src/index.ts"]
