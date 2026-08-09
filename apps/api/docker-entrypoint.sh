#!/bin/sh
set -eu

echo "Running Prisma migrations..."
bunx prisma migrate deploy

echo "Running seed (first-run bootstrap + rank normalization)..."
bun run prisma/seed.ts

exec "$@"
