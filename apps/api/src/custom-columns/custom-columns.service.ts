import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CustomColumn, Prisma } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomColumnDto } from './dto/create-custom-column.dto';
import { UpdateCustomColumnDto } from './dto/update-custom-column.dto';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

@Injectable()
export class CustomColumnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly events: EventsService,
  ) {}

  async list(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');
    return this.prisma.customColumn.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
    });
  }

  async create(projectId: string, dto: CreateCustomColumnDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (dto.settings) this.validateSettings(dto.type, dto.settings);
    const position = await this.prisma.customColumn.count({
      where: { projectId },
    });
    const column = await this.prisma.customColumn.create({
      data: {
        projectId,
        name: dto.name,
        type: dto.type,
        position,
        settings: (dto.settings ?? {}) as Prisma.InputJsonValue,
      },
    });
    this.events.emit(projectId, 'project');
    return column;
  }

  async update(columnId: string, dto: UpdateCustomColumnDto) {
    const column = await this.getColumn(columnId);
    if (dto.settings) this.validateSettings(column.type, dto.settings);
    const updated = await this.prisma.customColumn.update({
      where: { id: columnId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        ...(dto.settings !== undefined
          ? { settings: dto.settings as Prisma.InputJsonValue }
          : {}),
      },
    });
    this.events.emit(column.projectId, 'project');
    return updated;
  }

  async remove(columnId: string) {
    const column = await this.getColumn(columnId);
    await this.prisma.customColumn.delete({ where: { id: columnId } });
    this.events.emit(column.projectId, 'project');
    return { ok: true, id: columnId };
  }

  async setValue(
    issueId: string,
    columnId: string,
    value: Record<string, unknown> | null,
    actorId: string,
  ) {
    const issue = await this.prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundException('Issue not found');
    const column = await this.getColumn(columnId);
    if (column.projectId !== issue.projectId) {
      throw new BadRequestException('Column belongs to a different project');
    }

    if (value === null) {
      await this.prisma.issueCustomValue.deleteMany({
        where: { issueId, columnId },
      });
    } else {
      this.validateValue(column, value);
      await this.prisma.issueCustomValue.upsert({
        where: { issueId_columnId: { issueId, columnId } },
        create: { issueId, columnId, value: value as Prisma.InputJsonValue },
        update: { value: value as Prisma.InputJsonValue },
      });
    }

    await this.activity.record({
      projectId: issue.projectId,
      issueId,
      actorId,
      type: 'updated',
      payload: { customColumn: column.name, cleared: value === null },
    });

    this.events.emit(issue.projectId, 'issue');
    return { ok: true, issueId, columnId, value };
  }

  private async getColumn(columnId: string): Promise<CustomColumn> {
    const column = await this.prisma.customColumn.findUnique({
      where: { id: columnId },
    });
    if (!column) throw new NotFoundException('Custom column not found');
    return column;
  }

  /** Light shape validation of label-type option sets. */
  private validateSettings(type: string, settings: Record<string, unknown>) {
    if (type !== 'label') return;
    const options = settings.options;
    if (options === undefined) return;
    if (!Array.isArray(options)) {
      throw new BadRequestException('settings.options must be an array');
    }
    for (const opt of options) {
      const o = opt as Record<string, unknown>;
      if (
        typeof o !== 'object' ||
        o === null ||
        typeof o.id !== 'string' ||
        typeof o.name !== 'string' ||
        typeof o.color !== 'string' ||
        !HEX_RE.test(o.color)
      ) {
        throw new BadRequestException(
          'each option must be { id: string, name: string, color: #RRGGBB }',
        );
      }
    }
  }

  /** Validate value shape against the column type. */
  private validateValue(column: CustomColumn, value: Record<string, unknown>) {
    const fail = (expected: string): never => {
      throw new BadRequestException(
        `Invalid value for ${column.type} column, expected ${expected}`,
      );
    };
    switch (column.type) {
      case 'text':
        if (typeof value.text !== 'string' || value.text.length > 2000) {
          fail('{ text: string }');
        }
        break;
      case 'number':
        if (typeof value.number !== 'number' || Number.isNaN(value.number)) {
          fail('{ number: number }');
        }
        break;
      case 'date':
        if (
          typeof value.date !== 'string' ||
          Number.isNaN(Date.parse(value.date))
        ) {
          fail('{ date: ISO string }');
        }
        break;
      case 'label': {
        if (typeof value.optionId !== 'string') fail('{ optionId: string }');
        const settings = column.settings as { options?: { id: string }[] } | null;
        const options = settings?.options ?? [];
        if (!options.some((o) => o.id === value.optionId)) {
          throw new BadRequestException('optionId not found in column options');
        }
        break;
      }
      case 'person':
        if (typeof value.userId !== 'string') fail('{ userId: string }');
        break;
      case 'file':
        if (
          typeof value.attachmentId !== 'string' ||
          typeof value.filename !== 'string'
        ) {
          fail('{ attachmentId: string, filename: string }');
        }
        break;
      case 'checkbox':
        if (typeof value.checked !== 'boolean') fail('{ checked: boolean }');
        break;
    }
  }
}
