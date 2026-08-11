/**
 * One-off backfill: board columns used to get a fixed palette color stamped
 * at creation. Now color=null means "follow the project theme". Reset any
 * column whose stored color equals the old creation default for its position
 * so it becomes theme-driven; anything else is treated as user-chosen and
 * kept. Run with: bun run scripts/backfill-theme-column-colors.ts
 */
import { PrismaClient } from '@prisma/client';

// Old rotating creation palette (positions 0-2 were also the project-create
// defaults for To Do / In Progress / Done).
const OLD_PALETTE = [
  '#7aa2f7',
  '#e0af68',
  '#9ece6a',
  '#bb9af7',
  '#f7768e',
  '#7dcfff',
  '#ff9e64',
  '#73daca',
];

const prisma = new PrismaClient();

async function main() {
  const columns = await prisma.boardColumn.findMany({
    where: { color: { not: null } },
    select: { id: true, name: true, position: true, color: true, project: { select: { key: true } } },
  });
  let reset = 0;
  for (const col of columns) {
    const oldDefault = OLD_PALETTE[col.position % OLD_PALETTE.length];
    if (col.color?.toLowerCase() === oldDefault) {
      await prisma.boardColumn.update({
        where: { id: col.id },
        data: { color: null },
      });
      console.log(`${col.project.key} / ${col.name}: ${col.color} -> theme default`);
      reset += 1;
    } else {
      console.log(`${col.project.key} / ${col.name}: kept explicit ${col.color}`);
    }
  }
  console.log(`done — ${reset} column(s) now follow the theme`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
