import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthActor } from '../auth/auth.types';
import { AttachmentsService } from './attachments.service';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

@ApiTags('attachments')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller()
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get('issues/:issueId/attachments')
  @ApiOperation({ summary: 'List attachments for an issue' })
  list(@Param('issueId') issueId: string) {
    return this.attachments.listForIssue(issueId);
  }

  @Post('issues/:issueId/attachments')
  @ApiOperation({
    summary: 'Upload a file attachment (multipart/form-data, field "file", max 20 MB)',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  upload(
    @Param('issueId') issueId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthActor,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Missing file: send multipart/form-data with a "file" field',
      );
    }
    return this.attachments.upload(issueId, file, user.id);
  }

  @Get('attachments/:attachmentId/download')
  @ApiOperation({ summary: 'Download an attachment' })
  async download(
    @Param('attachmentId') attachmentId: string,
  ): Promise<StreamableFile> {
    const { attachment, stream } = await this.attachments.download(attachmentId);
    return new StreamableFile(stream, {
      type: attachment.mimeType,
      length: attachment.size,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
    });
  }

  @Delete('attachments/:attachmentId')
  @ApiOperation({ summary: 'Delete an attachment (removes the file on disk)' })
  remove(
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: AuthActor,
  ) {
    return this.attachments.remove(attachmentId, user.id);
  }
}
