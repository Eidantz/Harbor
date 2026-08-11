import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DEFAULT_COLUMN_NAMES,
  DEFAULT_DONE_COLUMN_NAME,
  DEFAULT_LABELS,
} from '../common/constants';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

/** Keep only finite numeric widths, clamped to a sane pixel range. */
function sanitizeListWidths(raw: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    out[key] = Math.round(Math.min(1200, Math.max(60, value)));
  }
  return out;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  list() {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { issues: true, columns: true } },
      },
    });
  }

  async get(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        columns: { orderBy: { position: 'asc' } },
        _count: { select: { issues: true, labels: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async create(dto: CreateProjectDto) {
    const key = dto.key.toUpperCase();
    try {
      return await this.prisma.project.create({
        data: {
          name: dto.name,
          key,
          description: dto.description,
          ...(dto.theme !== undefined ? { theme: dto.theme } : {}),
          ...(dto.boardLayout !== undefined
            ? { boardLayout: dto.boardLayout }
            : {}),
          columns: {
            create: DEFAULT_COLUMN_NAMES.map((name, position) => ({
              name,
              position,
              isDone: name === DEFAULT_DONE_COLUMN_NAME,
              // null = theme-default accent, resolved client-side per theme
              color: null,
            })),
          },
          labels: {
            create: DEFAULT_LABELS.map((l) => ({ name: l.name, color: l.color })),
          },
        },
        include: { columns: { orderBy: { position: 'asc' } } },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(`Project key ${key} already exists`);
      }
      throw err;
    }
  }

  async update(projectId: string, dto: UpdateProjectDto) {
    await this.get(projectId);
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.theme !== undefined ? { theme: dto.theme } : {}),
        ...(dto.boardLayout !== undefined
          ? { boardLayout: dto.boardLayout }
          : {}),
        ...(dto.listFields !== undefined
          ? { listFields: dto.listFields }
          : {}),
        ...(dto.listWidths !== undefined
          ? { listWidths: sanitizeListWidths(dto.listWidths) }
          : {}),
      },
      include: { columns: { orderBy: { position: 'asc' } } },
    });
    this.events.emit(projectId, 'project');
    return project;
  }

  async remove(projectId: string) {
    const project = await this.get(projectId);
    await this.prisma.$transaction([
      // Issues must be deleted before the project cascade reaches columns:
      // Issue.columnId is onDelete: Restrict, so cascading column deletion
      // would fail while issues still reference them.
      this.prisma.issue.deleteMany({ where: { projectId } }),
      this.prisma.project.delete({ where: { id: projectId } }),
    ]);
    return { ok: true, id: projectId, key: project.key };
  }

  async listColumns(projectId: string) {
    await this.get(projectId);
    return this.prisma.boardColumn.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
    });
  }

  async getBoard(projectId: string) {
    await this.get(projectId);
    const [columns, customColumns] = await Promise.all([
      this.prisma.boardColumn.findMany({
        where: { projectId },
        orderBy: { position: 'asc' },
        include: {
          issues: {
            where: {
              parentId: null,
              archivedAt: null,
            },
            orderBy: { rank: 'asc' },
            include: {
              labels: { include: { label: true } },
              epic: { select: { id: true, name: true, color: true } },
              customValues: true,
              _count: {
                select: {
                  subtasks: true,
                  linksTo: { where: { type: 'blocks' } },
                  linksFrom: { where: { type: 'blocks' } },
                },
              },
              assignee: { select: { id: true, email: true } },
              // Nested subitems for the Monday-style list view. Subtasks stay
              // under their parent regardless of their own column.
              subtasks: {
                where: { archivedAt: null },
                orderBy: { rank: 'asc' },
                include: {
                  labels: { include: { label: true } },
                  customValues: true,
                  _count: {
                    select: {
                      subtasks: true,
                      linksTo: { where: { type: 'blocks' } },
                      linksFrom: { where: { type: 'blocks' } },
                    },
                  },
                  assignee: { select: { id: true, email: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.customColumn.findMany({
        where: { projectId },
        orderBy: { position: 'asc' },
      }),
    ]);
    return { projectId, columns, customColumns };
  }
}
