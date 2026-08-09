import {
  Body,
  Controller,
  Delete,
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
import { ColumnsService } from './columns.service';
import { CreateColumnDto } from './dto/create-column.dto';
import { ReorderColumnsDto } from './dto/reorder-columns.dto';
import { UpdateColumnDto } from './dto/update-column.dto';

@ApiTags('columns')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller()
export class ColumnsController {
  constructor(private readonly columns: ColumnsService) {}

  @Post('projects/:projectId/columns')
  @ApiOperation({ summary: 'Create a board column' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateColumnDto,
  ) {
    return this.columns.create(projectId, dto);
  }

  @Put('projects/:projectId/columns/reorder')
  @ApiOperation({ summary: 'Reorder board columns' })
  reorder(
    @Param('projectId') projectId: string,
    @Body() dto: ReorderColumnsDto,
  ) {
    return this.columns.reorder(projectId, dto);
  }

  @Patch('columns/:columnId')
  @ApiOperation({ summary: 'Update a board column (name, position, isDone)' })
  update(@Param('columnId') columnId: string, @Body() dto: UpdateColumnDto) {
    return this.columns.update(columnId, dto);
  }

  @Delete('columns/:columnId')
  @ApiOperation({
    summary: 'Delete a board column (must be empty; cannot delete last column)',
  })
  remove(@Param('columnId') columnId: string) {
    return this.columns.remove(columnId);
  }
}
