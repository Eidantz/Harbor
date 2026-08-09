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
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthActor } from '../auth/auth.types';
import { AttachLabelDto } from './dto/attach-label.dto';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { LabelsService } from './labels.service';

@ApiTags('labels')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller()
export class LabelsController {
  constructor(private readonly labels: LabelsService) {}

  @Get('projects/:projectId/labels')
  @ApiOperation({ summary: 'List labels for a project' })
  list(@Param('projectId') projectId: string) {
    return this.labels.list(projectId);
  }

  @Post('projects/:projectId/labels')
  @ApiOperation({ summary: 'Create a label' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateLabelDto,
  ) {
    return this.labels.create(projectId, dto);
  }

  @Patch('labels/:labelId')
  @ApiOperation({ summary: 'Update a label' })
  update(@Param('labelId') labelId: string, @Body() dto: UpdateLabelDto) {
    return this.labels.update(labelId, dto);
  }

  @Delete('labels/:labelId')
  @ApiOperation({ summary: 'Delete a label' })
  remove(@Param('labelId') labelId: string) {
    return this.labels.remove(labelId);
  }

  @Post('issues/:issueId/labels')
  @ApiOperation({ summary: 'Attach label to issue' })
  attach(
    @Param('issueId') issueId: string,
    @Body() dto: AttachLabelDto,
    @CurrentUser() user: AuthActor,
  ) {
    return this.labels.attach(issueId, dto.labelId, user.id);
  }

  @Delete('issues/:issueId/labels/:labelId')
  @ApiOperation({ summary: 'Detach label from issue' })
  detach(
    @Param('issueId') issueId: string,
    @Param('labelId') labelId: string,
    @CurrentUser() user: AuthActor,
  ) {
    return this.labels.detach(issueId, labelId, user.id);
  }
}
