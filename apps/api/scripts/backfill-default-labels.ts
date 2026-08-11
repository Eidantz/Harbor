/**
 * One-off backfill: ensure every existing project has the Monday-style
 * default labels (Done / Working on it / Stuck). Additive only — existing
 * labels are never modified. Run with: bun run scripts/backfill-default-labels.ts
 */
import { PrismaClient } from '@prisma/client';
import { DEFAULT_LABELS } from '../src/common/constants';

const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({ include: { labels: true } });
  for (const project of projects) {
    const existing = new Set(project.labels.map((l) => l.name.toLowerCase()));
    const missing = DEFAULT_LABELS.filter((l) => !existing.has(l.name.toLowerCase()));
    for (const label of missing) {
      await prisma.label.create({
        data: { projectId: project.id, name: label.name, color: label.color },
      });
    }
    console.log(
      `${project.key}: added ${missing.length ? missing.map((l) => l.name).join(', ') : 'nothing (already present)'}`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
