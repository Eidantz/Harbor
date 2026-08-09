import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchIssues(q: string, limit: number) {
    const items = await this.prisma.issue.findMany({
      where: {
        archivedAt: null,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { key: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        key: true,
        title: true,
        type: true,
        priority: true,
        parentId: true,
        updatedAt: true,
        project: { select: { id: true, key: true, name: true } },
        column: { select: { id: true, name: true } },
      },
    });
    return { q, items };
  }
}
