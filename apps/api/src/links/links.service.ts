import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IssueLinkType, Prisma } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLinkDto } from './dto/create-link.dto';

@Injectable()
export class LinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly events: EventsService,
  ) {}

  async listForIssue(issueId: string) {
    const issue = await this.prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundException('Issue not found');

    const [outgoing, incoming] = await Promise.all([
      this.prisma.issueLink.findMany({
        where: { sourceId: issueId },
        include: {
          target: {
            select: { id: true, key: true, title: true, columnId: true },
          },
        },
      }),
      this.prisma.issueLink.findMany({
        where: { targetId: issueId },
        include: {
          source: {
            select: { id: true, key: true, title: true, columnId: true },
          },
        },
      }),
    ]);

    return {
      issueId,
      blocks: outgoing.filter((l) => l.type === 'blocks'),
      blockedBy: incoming.filter((l) => l.type === 'blocks'),
      // relates_to is symmetric: merge both directions
      relatesTo: [
        ...outgoing.filter((l) => l.type === 'relates_to'),
        ...incoming.filter((l) => l.type === 'relates_to'),
      ],
      duplicates: outgoing.filter((l) => l.type === 'duplicates'),
      duplicatedBy: incoming.filter((l) => l.type === 'duplicates'),
    };
  }

  /** True if following blocks edges from `fromId` can reach `toId`. */
  private async canReach(fromId: string, toId: string): Promise<boolean> {
    const visited = new Set<string>();
    const queue = [fromId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (id === toId) return true;
      if (visited.has(id)) continue;
      visited.add(id);
      const outgoing = await this.prisma.issueLink.findMany({
        where: { sourceId: id, type: 'blocks' },
        select: { targetId: true },
      });
      for (const edge of outgoing) {
        if (!visited.has(edge.targetId)) queue.push(edge.targetId);
      }
    }
    return false;
  }

  async create(sourceId: string, dto: CreateLinkDto, actorId: string) {
    const type = dto.type ?? IssueLinkType.blocks;
    if (sourceId === dto.targetId) {
      throw new BadRequestException('Self-links are not allowed');
    }

    const [source, target] = await Promise.all([
      this.prisma.issue.findUnique({ where: { id: sourceId } }),
      this.prisma.issue.findUnique({ where: { id: dto.targetId } }),
    ]);
    if (!source) throw new NotFoundException('Source issue not found');
    if (!target) throw new NotFoundException('Target issue not found');
    if (source.projectId !== target.projectId) {
      throw new BadRequestException('Issues must belong to the same project');
    }

    // Cycle: if target already (transitively) blocks source, adding source→target cycles.
    // Only blocks links form a dependency graph; other types are informational.
    if (
      type === IssueLinkType.blocks &&
      (await this.canReach(dto.targetId, sourceId))
    ) {
      throw new BadRequestException(
        'Link would create a cycle in the blocker graph',
      );
    }

    try {
      const link = await this.prisma.issueLink.create({
        data: {
          sourceId,
          targetId: dto.targetId,
          type,
        },
        include: {
          source: { select: { id: true, key: true, title: true } },
          target: { select: { id: true, key: true, title: true } },
        },
      });

      await this.activity.record({
        projectId: source.projectId,
        issueId: sourceId,
        actorId,
        type: 'linked',
        payload: {
          linkId: link.id,
          type,
          sourceId,
          targetId: dto.targetId,
          sourceKey: source.key,
          targetKey: target.key,
        },
      });

      this.events.emit(source.projectId, 'link');
      return link;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Link already exists');
      }
      throw err;
    }
  }

  async remove(linkId: string, actorId: string) {
    const link = await this.prisma.issueLink.findUnique({
      where: { id: linkId },
      include: {
        source: { select: { id: true, key: true, projectId: true } },
        target: { select: { id: true, key: true } },
      },
    });
    if (!link) throw new NotFoundException('Link not found');

    await this.prisma.issueLink.delete({ where: { id: linkId } });

    await this.activity.record({
      projectId: link.source.projectId,
      issueId: link.sourceId,
      actorId,
      type: 'linked',
      payload: {
        deleted: true,
        linkId,
        type: link.type,
        sourceId: link.sourceId,
        targetId: link.targetId,
      },
    });

    this.events.emit(link.source.projectId, 'link');
    return { ok: true, id: linkId };
  }
}
