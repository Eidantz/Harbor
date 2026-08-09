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
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List projects' })
  list() {
    return this.projects.list();
  }

  @Post()
  @ApiOperation({
    summary:
      'Create project with default columns (To Do / In Progress / Done; Done has isDone). Optional theme + boardLayout.',
  })
  create(@Body() dto: CreateProjectDto) {
    return this.projects.create(dto);
  }

  @Get(':projectId')
  @ApiOperation({ summary: 'Get project' })
  get(@Param('projectId') projectId: string) {
    return this.projects.get(projectId);
  }

  @Patch(':projectId')
  @ApiOperation({ summary: 'Update project (name, description, theme, boardLayout)' })
  update(@Param('projectId') projectId: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(projectId, dto);
  }

  @Delete(':projectId')
  @ApiOperation({
    summary:
      'Delete project and everything in it (columns, issues, epics, labels, activity). Irreversible.',
  })
  remove(@Param('projectId') projectId: string) {
    return this.projects.remove(projectId);
  }

  @Get(':projectId/columns')
  @ApiOperation({ summary: 'List board columns for a project' })
  columns(@Param('projectId') projectId: string) {
    return this.projects.listColumns(projectId);
  }

  @Get(':projectId/board')
  @ApiOperation({ summary: 'Board view: columns with ordered top-level issues' })
  board(@Param('projectId') projectId: string) {
    return this.projects.getBoard(projectId);
  }
}
