import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateEpicDto } from './dto/create-epic.dto';
import { UpdateEpicDto } from './dto/update-epic.dto';
import { EpicsService } from './epics.service';

@ApiTags('epics')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller()
export class EpicsController {
  constructor(private readonly epics: EpicsService) {}

  @Get('projects/:projectId/epics')
  @ApiOperation({ summary: 'List epics for a project' })
  list(@Param('projectId') projectId: string) {
    return this.epics.list(projectId);
  }

  @Post('projects/:projectId/epics')
  @ApiOperation({ summary: 'Create an epic' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateEpicDto,
  ) {
    return this.epics.create(projectId, dto);
  }

  @Get('epics/:epicId')
  @ApiOperation({ summary: 'Get epic detail with linked issues' })
  get(@Param('epicId') epicId: string) {
    return this.epics.get(epicId);
  }

  @Patch('epics/:epicId')
  @ApiOperation({ summary: 'Update an epic' })
  update(@Param('epicId') epicId: string, @Body() dto: UpdateEpicDto) {
    return this.epics.update(epicId, dto);
  }

  @Delete('epics/:epicId')
  @ApiOperation({ summary: 'Delete an epic (issues keep epicId cleared)' })
  remove(@Param('epicId') epicId: string) {
    return this.epics.remove(epicId);
  }
}
