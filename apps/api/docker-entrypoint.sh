#!/bin/sh
set -eu

echo "Running Prisma migrations..."
pnpm exec prisma migrate deploy

echo "Running seed (first-run bootstrap + rank normalization)..."
pnpm exec tsx prisma/seed.ts

exec "$@"
