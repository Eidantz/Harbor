import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEpicDto } from './dto/create-epic.dto';
import { UpdateEpicDto } from './dto/update-epic.dto';

@Injectable()
export class EpicsService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async list(projectId: string) {
    await this.requireProject(projectId);
    return this.prisma.epic.findMany({
      where: { projectId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { issues: true } },
      },
    });
  }

  async get(epicId: string) {
    const epic = await this.prisma.epic.findUnique({
      where: { id: epicId },
      include: {
        _count: { select: { issues: true } },
        issues: {
          where: { parentId: null },
          orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            key: true,
            title: true,
            type: true,
            priority: true,
            columnId: true,
            column: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!epic) throw new NotFoundException('Epic not found');
    return epic;
  }

  async create(projectId: string, dto: CreateEpicDto) {
    await this.requireProject(projectId);
    const last = await this.prisma.epic.findFirst({
      where: { projectId },
      orderBy: { position: 'desc' },
    });
    const position = last ? last.position + 1 : 0;
    return this.prisma.epic.create({
      data: {
        projectId,
        name: dto.name,
        description: dto.description,
        color: dto.color ?? '#7aa2f7',
        position,
      },
      include: { _count: { select: { issues: true } } },
    });
  }

  async update(epicId: string, dto: UpdateEpicDto) {
    await this.get(epicId);
    return this.prisma.epic.update({
      where: { id: epicId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
      },
      include: { _count: { select: { issues: true } } },
    });
  }

  async remove(epicId: string) {
    await this.get(epicId);
    await this.prisma.epic.delete({ where: { id: epicId } });
    return { ok: true, id: epicId };
  }
}
