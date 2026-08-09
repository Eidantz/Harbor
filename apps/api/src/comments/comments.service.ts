import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly events: EventsService,
  ) {}

  async list(issueId: string) {
    const issue = await this.prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundException('Issue not found');
    return this.prisma.comment.findMany({
      where: { issueId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, email: true } } },
    });
  }

  async create(issueId: string, dto: CreateCommentDto, actorId: string) {
    const issue = await this.prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundException('Issue not found');

    const comment = await this.prisma.comment.create({
      data: {
        issueId,
        authorId: actorId,
        body: dto.body,
      },
      include: { author: { select: { id: true, email: true } } },
    });

    await this.activity.record({
      projectId: issue.projectId,
      issueId,
      actorId,
      type: 'commented',
      payload: { commentId: comment.id },
    });

    this.events.emit(issue.projectId, 'comment');
    return comment;
  }

  async remove(commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { issue: { select: { projectId: true } } },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    await this.prisma.comment.delete({ where: { id: commentId } });
    this.events.emit(comment.issue.projectId, 'comment');
    return { ok: true, id: commentId };
  }
}
