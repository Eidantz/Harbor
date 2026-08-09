import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthActor } from '../auth/auth.types';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('comments')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('issues/:issueId/comments')
  @ApiOperation({ summary: 'List comments on an issue' })
  list(@Param('issueId') issueId: string) {
    return this.comments.list(issueId);
  }

  @Post('issues/:issueId/comments')
  @ApiOperation({ summary: 'Add a comment' })
  create(
    @Param('issueId') issueId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthActor,
  ) {
    return this.comments.create(issueId, dto, user.id);
  }

  @Delete('comments/:commentId')
  @ApiOperation({ summary: 'Delete a comment' })
  remove(@Param('commentId') commentId: string) {
    return this.comments.remove(commentId);
  }
}
