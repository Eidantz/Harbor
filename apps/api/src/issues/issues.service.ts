import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { rankAfter, rankBetween, rankInitial } from '../common/rank';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { ListIssuesQueryDto } from './dto/list-issues.dto';
import { MoveIssueDto } from './dto/move-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';

const issueLinkPartySelect = {
  id: true,
  key: true,
  title: true,
  type: true,
  parentId: true,
  columnId: true,
} satisfies Prisma.IssueSelect;

const epicSummarySelect = {
  id: true,
  name: true,
  color: true,
} satisfies Prisma.EpicSelect;

const issueDetailInclude = {
  column: true,
  epic: { select: epicSummarySelect },
  parent: { select: { id: true, key: true, title: true } },
  subtasks: { orderBy: { rank: 'asc' as const } },
  assignee: { select: { id: true, email: true } },
  labels: { include: { label: true } },
  linksFrom: {
    include: {
      target: { select: issueLinkPartySelect },
    },
  },
  linksTo: {
    include: {
      source: {
        select: {
          ...issueLinkPartySelect,
          column: { select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.IssueInclude;

type IssueDetailRecord = Prisma.IssueGetPayload<{
  include: typeof issueDetailInclude;
}>;

export type BlockerRef = {
  id: string;
  key: string;
  title: string;
  type: IssueDetailRecord['type'];
  parentId?: string;
};

export type BlockersSummary = {
  blockedBy: BlockerRef[];
  blocks: BlockerRef[];
};

function toBlockerRef(issue: {
  id: string;
  key: string;
  title: string;
  type: IssueDetailRecord['type'];
  parentId: string | null;
}): BlockerRef {
  return {
    id: issue.id,
    key: issue.key,
    title: issue.title,
    type: issue.type,
    ...(issue.parentId ? { parentId: issue.parentId } : {}),
  };
}

function blockersFromIssue(issue: IssueDetailRecord): BlockersSummary {
  return {
    blockedBy: issue.linksTo
      .filter((l) => l.type === 'blocks')
      .map((l) => toBlockerRef(l.source)),
    blocks: issue.linksFrom
      .filter((l) => l.type === 'blocks')
      .map((l) => toBlockerRef(l.target)),
  };
}

function withBlockers<T extends IssueDetailRecord>(issue: T) {
  return { ...issue, blockers: blockersFromIssue(issue) };
}

@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly events: EventsService,
  ) {}

  private async requireProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async get(issueId: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: issueDetailInclude,
    });
    if (!issue) throw new NotFoundException('Issue not found');
    return withBlockers(issue);
  }

  async list(projectId: string, query: ListIssuesQueryDto) {
    await this.requireProject(projectId);
    const where: Prisma.IssueWhereInput = { projectId };

    if (query.columnId) where.columnId = query.columnId;

    if (query.parentId !== undefined) {
      where.parentId =
        query.parentId === 'null' || query.parentId === ''
          ? null
          : query.parentId;
    }

    const archived = query.archived ?? 'false';
    if (archived === 'false') where.archivedAt = null;
    else if (archived === 'true') where.archivedAt = { not: null };

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { key: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const [items, total] = await Promise.all([
      this.prisma.issue.findMany({
        where,
        orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
        take: limit,
        skip: offset,
        include: {
          column: { select: { id: true, name: true } },
          epic: { select: epicSummarySelect },
          labels: { include: { label: true } },
          assignee: { select: { id: true, email: true } },
          _count: { select: { subtasks: true } },
        },
      }),
      this.prisma.issue.count({ where }),
    ]);
    return { items, total, limit, offset };
  }

  private async resolveEpicId(
    projectId: string,
    epicId: string | null | undefined,
    isSubtask: boolean,
  ): Promise<string | null | undefined> {
    if (epicId === undefined) return undefined;
    if (epicId === null) return null;
    if (isSubtask) {
      throw new BadRequestException('Subtasks cannot be assigned to an epic');
    }
    const epic = await this.prisma.epic.findFirst({
      where: { id: epicId, projectId },
    });
    if (!epic) throw new BadRequestException('Invalid epicId for project');
    return epicId;
  }

  async create(projectId: string, dto: CreateIssueDto, actorId: string) {
    await this.requireProject(projectId);

    let columnId = dto.columnId;
    if (!columnId) {
      const first = await this.prisma.boardColumn.findFirst({
        where: { projectId },
        orderBy: { position: 'asc' },
      });
      if (!first) throw new BadRequestException('Project has no columns');
      columnId = first.id;
    } else {
      const col = await this.prisma.boardColumn.findFirst({
        where: { id: columnId, projectId },
      });
      if (!col) throw new BadRequestException('Invalid columnId for project');
    }

    if (dto.parentId) {
      const parent = await this.prisma.issue.findFirst({
        where: { id: dto.parentId, projectId },
      });
      if (!parent) throw new BadRequestException('Invalid parentId');
      if (parent.parentId) {
        throw new BadRequestException('Nested subtasks are not supported');
      }
    }

    const epicId = await this.resolveEpicId(
      projectId,
      dto.epicId,
      Boolean(dto.parentId),
    );

    const lastInColumn = await this.prisma.issue.findFirst({
      where: { projectId, columnId, parentId: dto.parentId ?? null },
      orderBy: { rank: 'desc' },
    });
    const rank = lastInColumn ? rankAfter(lastInColumn.rank) : rankInitial();

    const issue = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id: projectId },
        data: { issueCounter: { increment: 1 } },
        select: { issueCounter: true, key: true },
      });
      const number = updated.issueCounter;
      const key = `${updated.key}-${number}`;
      return tx.issue.create({
        data: {
          projectId,
          columnId: columnId!,
          parentId: dto.parentId ?? null,
          epicId: epicId ?? null,
          assigneeId: dto.assigneeId === undefined ? actorId : dto.assigneeId,
          key,
          number,
          title: dto.title,
          description: dto.description,
          type: dto.type ?? 'task',
          priority: dto.priority ?? 'medium',
          humanEffort: dto.humanEffort ?? null,
          locEffort: dto.locEffort ?? null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          rank,
        },
        include: issueDetailInclude,
      });
    });

    await this.activity.record({
      projectId,
      issueId: issue.id,
      actorId,
      type: 'created',
      payload: { key: issue.key, title: issue.title, parentId: issue.parentId },
    });

    this.events.emit(projectId, 'issue');
    return withBlockers(issue);
  }

  async update(issueId: string, dto: UpdateIssueDto, actorId: string) {
    const existing = await this.get(issueId);

    const epicId = await this.resolveEpicId(
      existing.projectId,
      dto.epicId,
      Boolean(existing.parentId),
    );

    const data: Prisma.IssueUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.humanEffort !== undefined) data.humanEffort = dto.humanEffort;
    if (dto.locEffort !== undefined) data.locEffort = dto.locEffort;
    if (dto.dueDate !== undefined) {
      data.dueDate = dto.dueDate === null ? null : new Date(dto.dueDate);
    }
    if (dto.archived !== undefined) {
      const isArchived = existing.archivedAt !== null;
      if (dto.archived !== isArchived) {
        data.archivedAt = dto.archived ? new Date() : null;
      }
    }
    if (dto.assigneeId !== undefined) {
      data.assignee =
        dto.assigneeId === null
          ? { disconnect: true }
          : { connect: { id: dto.assigneeId } };
    }
    if (epicId !== undefined) {
      data.epic =
        epicId === null ? { disconnect: true } : { connect: { id: epicId } };
    }

    const issue = await this.prisma.issue.update({
      where: { id: issueId },
      data,
      include: issueDetailInclude,
    });

    await this.activity.record({
      projectId: issue.projectId,
      issueId: issue.id,
      actorId,
      type: 'updated',
      payload: { fields: Object.keys(dto) },
    });

    this.events.emit(issue.projectId, 'issue');
    return withBlockers(issue);
  }

  async remove(issueId: string, actorId: string) {
    const existing = await this.get(issueId);
    await this.prisma.issue.delete({ where: { id: issueId } });
    await this.activity.record({
      projectId: existing.projectId,
      issueId: null,
      actorId,
      type: 'updated',
      payload: { deleted: true, key: existing.key },
    });
    this.events.emit(existing.projectId, 'issue');
    return { ok: true, id: issueId, key: existing.key };
  }

  async listSubtasks(issueId: string) {
    await this.get(issueId);
    return this.prisma.issue.findMany({
      where: { parentId: issueId },
      orderBy: { rank: 'asc' },
      include: {
        column: { select: { id: true, name: true } },
        labels: { include: { label: true } },
      },
    });
  }

  async createSubtask(
    parentId: string,
    dto: CreateIssueDto,
    actorId: string,
  ) {
    const parent = await this.get(parentId);
    return this.create(
      parent.projectId,
      { ...dto, parentId },
      actorId,
    );
  }

  private async openBlockers(issueId: string) {
    const links = await this.prisma.issueLink.findMany({
      where: { targetId: issueId, type: 'blocks' },
      include: {
        source: {
          include: {
            column: { select: { id: true, name: true, isDone: true } },
          },
        },
      },
    });
    return links
      .filter((l) => !l.source.column.isDone && l.source.archivedAt === null)
      .map((l) => ({
        linkId: l.id,
        blocker: {
          id: l.source.id,
          key: l.source.key,
          title: l.source.title,
          column: l.source.column,
        },
      }));
  }

  async move(issueId: string, dto: MoveIssueDto, actorId: string) {
    const existing = await this.get(issueId);
    const column = await this.prisma.boardColumn.findFirst({
      where: { id: dto.columnId, projectId: existing.projectId },
    });
    if (!column) throw new BadRequestException('Invalid columnId for project');

    if (dto.beforeIssueId && dto.afterIssueId) {
      throw new BadRequestException(
        'Provide at most one of beforeIssueId or afterIssueId',
      );
    }

    // Same-column move with no anchor is a no-op: nothing to reorder.
    if (
      !dto.beforeIssueId &&
      !dto.afterIssueId &&
      dto.columnId === existing.columnId
    ) {
      return { issue: existing, warnings: [] };
    }

    const issue = await this.prisma.$transaction(async (tx) => {
      let beforeRank: string | null = null;
      let afterRank: string | null = null;

      if (dto.beforeIssueId) {
        const before = await tx.issue.findFirst({
          where: {
            id: dto.beforeIssueId,
            projectId: existing.projectId,
            columnId: dto.columnId,
          },
        });
        if (!before) {
          throw new BadRequestException(
            'beforeIssueId must be an issue in the target column',
          );
        }
        afterRank = before.rank;
        const prev = await tx.issue.findFirst({
          where: {
            projectId: existing.projectId,
            columnId: dto.columnId,
            rank: { lt: before.rank },
            id: { not: issueId },
          },
          orderBy: { rank: 'desc' },
        });
        beforeRank = prev?.rank ?? null;
      } else if (dto.afterIssueId) {
        const after = await tx.issue.findFirst({
          where: {
            id: dto.afterIssueId,
            projectId: existing.projectId,
            columnId: dto.columnId,
          },
        });
        if (!after) {
          throw new BadRequestException(
            'afterIssueId must be an issue in the target column',
          );
        }
        beforeRank = after.rank;
        const next = await tx.issue.findFirst({
          where: {
            projectId: existing.projectId,
            columnId: dto.columnId,
            rank: { gt: after.rank },
            id: { not: issueId },
          },
          orderBy: { rank: 'asc' },
        });
        afterRank = next?.rank ?? null;
      } else {
        const last = await tx.issue.findFirst({
          where: {
            projectId: existing.projectId,
            columnId: dto.columnId,
            id: { not: issueId },
          },
          orderBy: { rank: 'desc' },
        });
        beforeRank = last?.rank ?? null;
        afterRank = null;
      }

      const rank = rankBetween(beforeRank, afterRank);

      return tx.issue.update({
        where: { id: issueId },
        data: { columnId: dto.columnId, rank },
        include: issueDetailInclude,
      });
    });

    await this.activity.record({
      projectId: issue.projectId,
      issueId: issue.id,
      actorId,
      type: 'moved',
      payload: {
        fromColumnId: existing.columnId,
        toColumnId: dto.columnId,
        rank: issue.rank,
      },
    });

    this.events.emit(issue.projectId, 'issue');

    const warnings: Array<{
      code: string;
      message: string;
      blockers: Awaited<ReturnType<IssuesService['openBlockers']>>;
    }> = [];

    if (column.isDone) {
      const blockers = await this.openBlockers(issueId);
      if (blockers.length > 0) {
        warnings.push({
          code: 'OPEN_BLOCKERS',
          message:
            'Issue moved to Done while open blocker(s) remain (soft warning)',
          blockers,
        });
      }
    }

    return { issue: withBlockers(issue), warnings };
  }
}
