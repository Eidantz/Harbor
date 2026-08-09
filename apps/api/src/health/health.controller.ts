import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Liveness + DB check (served at /health, outside /api prefix)',
  })
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, service: 'kanban-api' };
  }
}
