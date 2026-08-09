import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';

@Injectable()
export class LabelsService {
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
    return this.prisma.label.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    });
  }

  async create(projectId: string, dto: CreateLabelDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');
    try {
      return await this.prisma.label.create({
        data: {
          projectId,
          name: dto.name,
          color: dto.color ?? '#6B7280',
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Label name already exists in project');
      }
      throw err;
    }
  }

  async update(labelId: string, dto: UpdateLabelDto) {
    const label = await this.prisma.label.findUnique({ where: { id: labelId } });
    if (!label) throw new NotFoundException('Label not found');
    try {
      const updated = await this.prisma.label.update({
        where: { id: labelId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.color !== undefined ? { color: dto.color } : {}),
        },
      });
      this.events.emit(label.projectId, 'label');
      return updated;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Label name already exists in project');
      }
      throw err;
    }
  }

  async remove(labelId: string) {
    const label = await this.prisma.label.findUnique({ where: { id: labelId } });
    if (!label) throw new NotFoundException('Label not found');
    await this.prisma.label.delete({ where: { id: labelId } });
    this.events.emit(label.projectId, 'label');
    return { ok: true, id: labelId };
  }

  async attach(issueId: string, labelId: string, actorId: string) {
    const issue = await this.prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundException('Issue not found');
    const label = await this.prisma.label.findUnique({ where: { id: labelId } });
    if (!label) throw new NotFoundException('Label not found');
    if (label.projectId !== issue.projectId) {
      throw new BadRequestException('Label belongs to a different project');
    }

    try {
      await this.prisma.issueLabel.create({
        data: { issueId, labelId },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // already attached — idempotent
      } else {
        throw err;
      }
    }

    await this.activity.record({
      projectId: issue.projectId,
      issueId,
      actorId,
      type: 'updated',
      payload: { labelAttached: labelId, labelName: label.name },
    });

    this.events.emit(issue.projectId, 'label');
    return this.prisma.issue.findUnique({
      where: { id: issueId },
      include: { labels: { include: { label: true } } },
    });
  }

  async detach(issueId: string, labelId: string, actorId: string) {
    const issue = await this.prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundException('Issue not found');

    await this.prisma.issueLabel.deleteMany({
      where: { issueId, labelId },
    });

    await this.activity.record({
      projectId: issue.projectId,
      issueId,
      actorId,
      type: 'updated',
      payload: { labelDetached: labelId },
    });

    this.events.emit(issue.projectId, 'label');
    return { ok: true, issueId, labelId };
  }
}
