import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthActor } from '../auth/auth.types';
import { CustomColumnsService } from './custom-columns.service';
import { CreateCustomColumnDto } from './dto/create-custom-column.dto';
import { SetCustomValueDto } from './dto/set-custom-value.dto';
import { UpdateCustomColumnDto } from './dto/update-custom-column.dto';

@ApiTags('custom-columns')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller()
export class CustomColumnsController {
  constructor(private readonly customColumns: CustomColumnsService) {}

  @Get('projects/:projectId/list-columns')
  @ApiOperation({ summary: 'List custom list-table columns for a project' })
  list(@Param('projectId') projectId: string) {
    return this.customColumns.list(projectId);
  }

  @Post('projects/:projectId/list-columns')
  @ApiOperation({ summary: 'Create a custom list-table column' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateCustomColumnDto,
  ) {
    return this.customColumns.create(projectId, dto);
  }

  @Patch('list-columns/:columnId')
  @ApiOperation({ summary: 'Update a custom column (name, position, settings)' })
  update(
    @Param('columnId') columnId: string,
    @Body() dto: UpdateCustomColumnDto,
  ) {
    return this.customColumns.update(columnId, dto);
  }

  @Delete('list-columns/:columnId')
  @ApiOperation({ summary: 'Delete a custom column and all its values' })
  remove(@Param('columnId') columnId: string) {
    return this.customColumns.remove(columnId);
  }

  @Put('issues/:issueId/values/:columnId')
  @ApiOperation({ summary: 'Set (or clear with null) an issue cell value for a custom column' })
  setValue(
    @Param('issueId') issueId: string,
    @Param('columnId') columnId: string,
    @Body() dto: SetCustomValueDto,
    @CurrentUser() user: AuthActor,
  ) {
    return this.customColumns.setValue(issueId, columnId, dto.value, user.id);
  }
}
