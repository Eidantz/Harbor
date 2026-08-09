import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthActor } from '../auth/auth.types';
import { CreateIssueDto } from './dto/create-issue.dto';
import { ListIssuesQueryDto } from './dto/list-issues.dto';
import { MoveIssueDto } from './dto/move-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { IssuesService } from './issues.service';

@ApiTags('issues')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller()
export class IssuesController {
  constructor(private readonly issues: IssuesService) {}

  @Get('projects/:projectId/issues')
  @ApiOperation({ summary: 'List issues in a project' })
  list(
    @Param('projectId') projectId: string,
    @Query() query: ListIssuesQueryDto,
  ) {
    return this.issues.list(projectId, query);
  }

  @Post('projects/:projectId/issues')
  @ApiOperation({ summary: 'Create issue (key from project.issueCounter)' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateIssueDto,
    @CurrentUser() user: AuthActor,
  ) {
    return this.issues.create(projectId, dto, user.id);
  }

  @Get('issues/:issueId')
  @ApiOperation({
    summary:
      'Get issue detail including blockers summary (blockedBy / blocks)',
  })
  get(@Param('issueId') issueId: string) {
    return this.issues.get(issueId);
  }

  @Patch('issues/:issueId')
  @ApiOperation({ summary: 'Update issue fields' })
  update(
    @Param('issueId') issueId: string,
    @Body() dto: UpdateIssueDto,
    @CurrentUser() user: AuthActor,
  ) {
    return this.issues.update(issueId, dto, user.id);
  }

  @Delete('issues/:issueId')
  @ApiOperation({ summary: 'Delete issue (cascades subtasks)' })
  remove(
    @Param('issueId') issueId: string,
    @CurrentUser() user: AuthActor,
  ) {
    return this.issues.remove(issueId, user.id);
  }

  @Post('issues/:issueId/move')
  @ApiOperation({
    summary: 'Move/rank issue into a column; soft-warns on Done with open blockers',
  })
  move(
    @Param('issueId') issueId: string,
    @Body() dto: MoveIssueDto,
    @CurrentUser() user: AuthActor,
  ) {
    return this.issues.move(issueId, dto, user.id);
  }

  @Get('issues/:issueId/subtasks')
  @ApiOperation({ summary: 'List subtasks' })
  listSubtasks(@Param('issueId') issueId: string) {
    return this.issues.listSubtasks(issueId);
  }

  @Post('issues/:issueId/subtasks')
  @ApiOperation({ summary: 'Create subtask under parent' })
  createSubtask(
    @Param('issueId') issueId: string,
    @Body() dto: CreateIssueDto,
    @CurrentUser() user: AuthActor,
  ) {
    return this.issues.createSubtask(issueId, dto, user.id);
  }
}
