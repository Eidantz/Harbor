import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthActor } from '../auth/auth.types';
import { CreateLinkDto } from './dto/create-link.dto';
import { LinksService } from './links.service';

@ApiTags('links')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller()
export class LinksController {
  constructor(private readonly links: LinksService) {}

  @Get('issues/:issueId/links')
  @ApiOperation({
    summary:
      'List links grouped by type: blocks / blockedBy, relatesTo, duplicates / duplicatedBy',
  })
  list(@Param('issueId') issueId: string) {
    return this.links.listForIssue(issueId);
  }

  @Post('issues/:issueId/links')
  @ApiOperation({
    summary:
      'Create link (blocks | relates_to | duplicates): this issue is the source, targetId the target. Rejects self-links; blocks links also reject cycles.',
  })
  create(
    @Param('issueId') issueId: string,
    @Body() dto: CreateLinkDto,
    @CurrentUser() user: AuthActor,
  ) {
    return this.links.create(issueId, dto, user.id);
  }

  @Delete('links/:linkId')
  @ApiOperation({ summary: 'Delete a link' })
  remove(
    @Param('linkId') linkId: string,
    @CurrentUser() user: AuthActor,
  ) {
    return this.links.remove(linkId, user.id);
  }
}
