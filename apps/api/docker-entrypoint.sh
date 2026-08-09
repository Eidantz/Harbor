#!/bin/sh
set -eu

echo "Running Prisma migrations..."
bunx prisma migrate deploy

echo "Running seed (first-run bootstrap + rank normalization)..."
bunx tsx prisma/seed.ts

exec "$@"
