import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';

const UPLOAD_DIR = resolve(
  process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'),
);

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly events: EventsService,
  ) {}

  async listForIssue(issueId: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });
    if (!issue) throw new NotFoundException('Issue not found');
    return this.prisma.attachment.findMany({
      where: { issueId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async upload(issueId: string, file: Express.Multer.File, actorId: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });
    if (!issue) throw new NotFoundException('Issue not found');

    // Randomized on-disk name; keep the (sanitized) extension for tooling
    const ext = extname(file.originalname).slice(0, 16).replace(/[^.\w-]/g, '');
    const storedName = `${randomUUID()}${ext}`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(join(UPLOAD_DIR, storedName), file.buffer);

    const attachment = await this.prisma.attachment.create({
      data: {
        issueId,
        filename: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size,
        storedName,
      },
    });

    await this.activity.record({
      projectId: issue.projectId,
      issueId,
      actorId,
      type: 'updated',
      payload: {
        action: 'attachment_added',
        attachmentId: attachment.id,
        filename: attachment.filename,
      },
    });

    this.events.emit(issue.projectId, 'attachment');
    return attachment;
  }

  async download(attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    const path = join(UPLOAD_DIR, attachment.storedName);
    const exists = await stat(path).catch(() => null);
    if (!exists) throw new NotFoundException('Attachment file missing on disk');

    return { attachment, stream: createReadStream(path) };
  }

  async remove(attachmentId: string, actorId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { issue: { select: { id: true, projectId: true } } },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    await this.prisma.attachment.delete({ where: { id: attachmentId } });
    await unlink(join(UPLOAD_DIR, attachment.storedName)).catch(
      () => undefined,
    );

    await this.activity.record({
      projectId: attachment.issue.projectId,
      issueId: attachment.issue.id,
      actorId,
      type: 'updated',
      payload: {
        action: 'attachment_removed',
        attachmentId,
        filename: attachment.filename,
      },
    });

    this.events.emit(attachment.issue.projectId, 'attachment');
    return { ok: true, id: attachmentId };
  }
}
