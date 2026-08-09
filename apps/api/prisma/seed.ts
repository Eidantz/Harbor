import { PrismaClient, type IssuePriority, type IssueType } from '@prisma/client';
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

const prisma = new PrismaClient();

const DEFAULT_COLUMNS = [
  { name: 'To Do', isDone: false, color: '#7aa2f7' },
  { name: 'In Progress', isDone: false, color: '#e0af68' },
  { name: 'Done', isDone: true, color: '#9ece6a' },
] as const;

function isValidRank(rank: string): boolean {
  try {
    generateKeyBetween(rank, null);
    return true;
  } catch {
    return false;
  }
}

/**
 * The admin account is created via UI signup only. Seed just looks up the
 * existing user so sample issues can be assigned to them (null on fresh DB;
 * signup claims unassigned seed issues afterwards).
 */
async function findAdminUser(): Promise<string | null> {
  const existing = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (existing) {
    console.log(`  user:    existing (${existing.email}) — left untouched`);
    return existing.id;
  }
  console.log('  user:    none — complete admin signup in the UI');
  return null;
}

/**
 * Create the sample KAN project, columns, labels, issues, and epics.
 * Only called on a database with zero projects — everything is create-only.
 */
async function createSampleData(userId: string | null) {
  const project = await prisma.project.create({
    data: {
      name: 'Sample Kanban',
      key: 'KAN',
      description: 'Seeded sample project with default board columns.',
      theme: 'tokyo-night',
      boardLayout: 'columns',
      columns: {
        create: DEFAULT_COLUMNS.map((col, position) => ({
          name: col.name,
          position,
          isDone: col.isDone,
          color: col.color,
        })),
      },
    },
    include: { columns: { orderBy: { position: 'asc' } } },
  });

  const byName = Object.fromEntries(project.columns.map((c) => [c.name, c.id]));
  const todoId = byName['To Do']!;
  const inProgressId = byName['In Progress']!;
  const doneId = byName['Done']!;

  const labels = await Promise.all(
    [
      { name: 'frontend', color: '#0D9488' },
      { name: 'backend', color: '#2563EB' },
      { name: 'docs', color: '#CA8A04' },
    ].map((l) =>
      prisma.label.create({
        data: { projectId: project.id, name: l.name, color: l.color },
      }),
    ),
  );
  const labelByName = Object.fromEntries(labels.map((l) => [l.name, l.id]));

  type SeedIssue = {
    title: string;
    description?: string;
    type?: IssueType;
    priority?: IssuePriority;
    columnId: string;
    humanEffort?: number | null;
    locEffort?: number | null;
    /** Index of parent in `specs` (for subtasks). */
    parentIndex?: number;
    labelNames?: string[];
  };

  const specs: SeedIssue[] = [
    {
      title: 'Welcome to Harbor',
      description: 'Sample story. Explore the board, list view, and column colors.',
      type: 'story',
      priority: 'high',
      columnId: todoId,
      humanEffort: 4,
      locEffort: 120,
      labelNames: ['docs'],
    },
    {
      title: 'Wire Kanban drag-and-drop',
      description: 'Card moves should persist column + rank via the API.',
      type: 'task',
      priority: 'high',
      columnId: inProgressId,
      humanEffort: 6,
      locEffort: 350,
      labelNames: ['frontend'],
    },
    {
      title: 'Add OpenAPI examples',
      description: 'Document auth cookie + Bearer flows in Swagger.',
      type: 'task',
      priority: 'medium',
      columnId: todoId,
      humanEffort: 2.5,
      locEffort: 80,
      labelNames: ['backend', 'docs'],
    },
    {
      title: 'Fix health check under load',
      description: 'Intermittent timeout when DB is cold-starting.',
      type: 'bug',
      priority: 'highest',
      columnId: todoId,
      humanEffort: 3,
      locEffort: 40,
      labelNames: ['backend'],
    },
    {
      title: 'Draft demo walkthrough',
      description: 'Short script for showing board and list layouts.',
      type: 'task',
      priority: 'low',
      columnId: todoId,
      humanEffort: 1,
      locEffort: null,
      labelNames: ['docs'],
    },
    {
      title: 'Ship login page',
      description: 'Already done — kept for Done-column sample.',
      type: 'task',
      priority: 'medium',
      columnId: doneId,
      humanEffort: 5,
      locEffort: 200,
      labelNames: ['frontend'],
    },
    {
      title: 'Write drawer acceptance checks',
      description: 'Subtask of the welcome story.',
      type: 'task',
      priority: 'medium',
      columnId: todoId,
      humanEffort: 1.5,
      locEffort: 60,
      parentIndex: 0,
    },
  ];

  let nextNumber = project.issueCounter;
  const createdIds: string[] = [];
  const lastRankByColumn = new Map<string, string>();

  for (const spec of specs) {
    nextNumber += 1;
    const key = `${project.key}-${nextNumber}`;
    const parentId =
      spec.parentIndex !== undefined ? createdIds[spec.parentIndex] : undefined;
    if (spec.parentIndex !== undefined && !parentId) {
      throw new Error(`Parent at index ${spec.parentIndex} not created yet`);
    }

    const rank = generateKeyBetween(
      lastRankByColumn.get(spec.columnId) ?? null,
      null,
    );
    lastRankByColumn.set(spec.columnId, rank);

    const issue = await prisma.issue.create({
      data: {
        projectId: project.id,
        columnId: spec.columnId,
        parentId: parentId ?? null,
        assigneeId: userId,
        key,
        number: nextNumber,
        title: spec.title,
        description: spec.description,
        type: spec.type ?? 'task',
        priority: spec.priority ?? 'medium',
        humanEffort: spec.humanEffort ?? null,
        locEffort: spec.locEffort ?? null,
        rank,
        labels: spec.labelNames?.length
          ? {
              create: spec.labelNames.map((name) => ({
                labelId: labelByName[name]!,
              })),
            }
          : undefined,
      },
    });
    createdIds.push(issue.id);
  }

  await prisma.project.update({
    where: { id: project.id },
    data: { issueCounter: nextNumber },
  });

  // "Add OpenAPI examples" (index 2) blocks "Wire Kanban drag-and-drop" (index 1)
  await prisma.issueLink.create({
    data: {
      sourceId: createdIds[2]!,
      targetId: createdIds[1]!,
      type: 'blocks',
    },
  });

  const authEpic = await prisma.epic.create({
    data: {
      projectId: project.id,
      name: 'Auth overhaul',
      description: 'Login, sessions, and API token flows.',
      color: '#f7768e',
      position: 0,
    },
  });
  const checkoutEpic = await prisma.epic.create({
    data: {
      projectId: project.id,
      name: 'Checkout flow',
      description: 'Board interactions and persistence.',
      color: '#7aa2f7',
      position: 1,
    },
  });
  // Welcome story + OpenAPI task → Auth overhaul; drag-and-drop → Checkout flow
  await prisma.issue.update({
    where: { id: createdIds[0]! },
    data: { epicId: authEpic.id },
  });
  await prisma.issue.update({
    where: { id: createdIds[2]! },
    data: { epicId: authEpic.id },
  });
  await prisma.issue.update({
    where: { id: createdIds[1]! },
    data: { epicId: checkoutEpic.id },
  });

  console.log('  sample:  created');
  console.log(`    project: ${project.key} (${project.name})`);
  console.log(
    `    columns: ${DEFAULT_COLUMNS.map((c) => (c.isDone ? `${c.name}*` : c.name)).join(', ')} (* = isDone)`,
  );
  console.log(`    issues:  ${specs.length} (incl. 1 subtask)`);
  console.log('    link:    Add OpenAPI examples → blocks → Wire Kanban drag-and-drop');
  console.log(`    labels:  ${labels.map((l) => l.name).join(', ')}`);
  console.log(`    epics:   ${authEpic.name}, ${checkoutEpic.name}`);
}

/**
 * One-time normalization: rewrite legacy (pre fractional-indexing) ranks.
 * Only touches columns that contain an invalid or duplicate rank; each such
 * column is rewritten in current visual order with fresh order keys.
 */
async function normalizeRanks() {
  const issues = await prisma.issue.findMany({
    select: { id: true, columnId: true, rank: true },
    orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
  });

  const byColumn = new Map<string, { id: string; rank: string }[]>();
  for (const issue of issues) {
    const list = byColumn.get(issue.columnId) ?? [];
    list.push(issue);
    byColumn.set(issue.columnId, list);
  }

  let rewritten = 0;
  for (const columnIssues of byColumn.values()) {
    const ranks = columnIssues.map((i) => i.rank);
    const needsRewrite =
      ranks.some((r) => !isValidRank(r)) || new Set(ranks).size !== ranks.length;
    if (!needsRewrite) continue;

    const keys = generateNKeysBetween(null, null, columnIssues.length);
    await prisma.$transaction(
      columnIssues.map((issue, index) =>
        prisma.issue.update({
          where: { id: issue.id },
          data: { rank: keys[index]! },
        }),
      ),
    );
    rewritten += columnIssues.length;
  }

  console.log(
    rewritten > 0
      ? `  ranks:   normalized ${rewritten} issue(s) to fractional-indexing keys`
      : '  ranks:   ok',
  );
}

async function main() {
  const userId = await findAdminUser();

  const projectCount = await prisma.project.count();
  if (projectCount > 0) {
    console.log(`  sample:  skipped (${projectCount} project(s) already exist)`);
  } else {
    await createSampleData(userId);
  }

  await normalizeRanks();
  console.log('Seed complete');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
