import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateColumnDto } from './dto/create-column.dto';
import { ReorderColumnsDto } from './dto/reorder-columns.dto';
import { UpdateColumnDto } from './dto/update-column.dto';

@Injectable()
export class ColumnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  private async getColumnOrThrow(columnId: string) {
    const column = await this.prisma.boardColumn.findUnique({
      where: { id: columnId },
      include: { _count: { select: { issues: true } } },
    });
    if (!column) throw new NotFoundException('Column not found');
    return column;
  }

  private async ensureProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async clearOtherDoneColumns(
    tx: Prisma.TransactionClient,
    projectId: string,
    exceptColumnId?: string,
  ) {
    await tx.boardColumn.updateMany({
      where: {
        projectId,
        isDone: true,
        ...(exceptColumnId ? { id: { not: exceptColumnId } } : {}),
      },
      data: { isDone: false },
    });
  }

  async create(projectId: string, dto: CreateColumnDto) {
    await this.ensureProject(projectId);

    const max = await this.prisma.boardColumn.aggregate({
      where: { projectId },
      _max: { position: true },
    });
    const position = (max._max.position ?? -1) + 1;
    const isDone = dto.isDone === true;

    try {
      const column = await this.prisma.$transaction(async (tx) => {
        if (isDone) {
          await this.clearOtherDoneColumns(tx, projectId);
        }
        return tx.boardColumn.create({
          data: {
            projectId,
            name: dto.name,
            position,
            isDone,
            // null = follow the project theme's default accent for this position
            color: dto.color ?? null,
          },
        });
      });
      this.events.emit(projectId, 'column');
      return column;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Column name already exists in project');
      }
      throw err;
    }
  }

  async update(columnId: string, dto: UpdateColumnDto) {
    const column = await this.getColumnOrThrow(columnId);

    if (
      dto.name === undefined &&
      dto.position === undefined &&
      dto.isDone === undefined &&
      dto.color === undefined
    ) {
      return column;
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (dto.isDone === true) {
          await this.clearOtherDoneColumns(tx, column.projectId, columnId);
        }

        if (dto.position !== undefined && dto.position !== column.position) {
          const columns = await tx.boardColumn.findMany({
            where: { projectId: column.projectId },
            orderBy: { position: 'asc' },
          });
          if (dto.position >= columns.length) {
            throw new BadRequestException(
              `position must be between 0 and ${columns.length - 1}`,
            );
          }

          const without = columns.filter((c) => c.id !== columnId);
          without.splice(dto.position, 0, column);
          // Two-phase update to satisfy @@unique([projectId, position])
          for (const [i, c] of without.entries()) {
            await tx.boardColumn.update({
              where: { id: c.id },
              data: { position: i + 1000 },
            });
          }
          for (const [i, c] of without.entries()) {
            await tx.boardColumn.update({
              where: { id: c.id },
              data: {
                position: i,
                ...(c.id === columnId
                  ? {
                      ...(dto.name !== undefined ? { name: dto.name } : {}),
                      ...(dto.isDone !== undefined ? { isDone: dto.isDone } : {}),
                      ...(dto.color !== undefined ? { color: dto.color } : {}),
                    }
                  : {}),
              },
            });
          }
          return tx.boardColumn.findUniqueOrThrow({ where: { id: columnId } });
        }

        return tx.boardColumn.update({
          where: { id: columnId },
          data: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.isDone !== undefined ? { isDone: dto.isDone } : {}),
            ...(dto.color !== undefined ? { color: dto.color } : {}),
          },
        });
      });
      this.events.emit(column.projectId, 'column');
      return updated;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Column name already exists in project');
      }
      throw err;
    }
  }

  async remove(columnId: string) {
    const column = await this.getColumnOrThrow(columnId);

    const count = await this.prisma.boardColumn.count({
      where: { projectId: column.projectId },
    });
    if (count <= 1) {
      throw new BadRequestException('Cannot delete the last column in a project');
    }
    if (column._count.issues > 0) {
      throw new BadRequestException(
        'Cannot delete a column that still contains issues; move them first',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.boardColumn.delete({ where: { id: columnId } });
      const remaining = await tx.boardColumn.findMany({
        where: { projectId: column.projectId },
        orderBy: { position: 'asc' },
      });
      for (const [i, c] of remaining.entries()) {
        if (c.position !== i) {
          await tx.boardColumn.update({
            where: { id: c.id },
            data: { position: i + 1000 },
          });
        }
      }
      for (const [i, c] of remaining.entries()) {
        if (c.position !== i) {
          await tx.boardColumn.update({
            where: { id: c.id },
            data: { position: i },
          });
        }
      }
    });

    this.events.emit(column.projectId, 'column');
    return { ok: true, id: columnId };
  }

  async reorder(projectId: string, dto: ReorderColumnsDto) {
    await this.ensureProject(projectId);

    const columns = await this.prisma.boardColumn.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
    });
    const existingIds = new Set(columns.map((c) => c.id));
    if (dto.columnIds.length !== columns.length) {
      throw new BadRequestException(
        'columnIds must include every column in the project exactly once',
      );
    }
    const seen = new Set<string>();
    for (const id of dto.columnIds) {
      if (!existingIds.has(id)) {
        throw new BadRequestException(`Unknown column id: ${id}`);
      }
      if (seen.has(id)) {
        throw new BadRequestException(`Duplicate column id: ${id}`);
      }
      seen.add(id);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const [i, id] of dto.columnIds.entries()) {
        await tx.boardColumn.update({
          where: { id },
          data: { position: i + 1000 },
        });
      }
      for (const [i, id] of dto.columnIds.entries()) {
        await tx.boardColumn.update({
          where: { id },
          data: { position: i },
        });
      }
    });

    this.events.emit(projectId, 'column');
    return this.prisma.boardColumn.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
    });
  }
}
