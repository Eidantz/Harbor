import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/pagination.dto';
import { ActivityService } from './activity.service';

@ApiTags('activity')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller()
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get('projects/:projectId/activity')
  @ApiOperation({ summary: 'List project activity (newest first)' })
  listForProject(
    @Param('projectId') projectId: string,
    @Query() query: PaginationQueryDto,
    @Query('issueId') issueId?: string,
  ) {
    return this.activity.list({
      projectId,
      issueId,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  }

  @Get('issues/:issueId/activity')
  @ApiOperation({ summary: 'List activity for an issue' })
  listForIssue(
    @Param('issueId') issueId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.activity.listForIssue({
      issueId,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  }
}
