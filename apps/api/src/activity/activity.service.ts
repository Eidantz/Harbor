import { Injectable } from '@nestjs/common';
import { ActivityType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: {
    projectId: string;
    issueId?: string | null;
    actorId?: string | null;
    type: ActivityType;
    payload?: Prisma.InputJsonValue;
  }) {
    return this.prisma.activityEvent.create({
      data: {
        projectId: params.projectId,
        issueId: params.issueId ?? null,
        actorId: params.actorId ?? null,
        type: params.type,
        payload: params.payload ?? {},
      },
    });
  }

  async list(params: {
    projectId: string;
    issueId?: string;
    limit: number;
    offset: number;
  }) {
    const where: Prisma.ActivityEventWhereInput = {
      projectId: params.projectId,
      ...(params.issueId ? { issueId: params.issueId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.activityEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit,
        skip: params.offset,
        include: {
          actor: { select: { id: true, email: true } },
          issue: { select: { id: true, key: true, title: true } },
        },
      }),
      this.prisma.activityEvent.count({ where }),
    ]);
    return { items, total, limit: params.limit, offset: params.offset };
  }

  async listForIssue(params: {
    issueId: string;
    limit: number;
    offset: number;
  }) {
    const where = { issueId: params.issueId };
    const [items, total] = await Promise.all([
      this.prisma.activityEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit,
        skip: params.offset,
        include: {
          actor: { select: { id: true, email: true } },
        },
      }),
      this.prisma.activityEvent.count({ where }),
    ]);
    return { items, total, limit: params.limit, offset: params.offset };
  }
}
