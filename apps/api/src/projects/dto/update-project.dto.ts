import { ApiPropertyOptional } from '@nestjs/swagger';
import { BoardLayout } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { LIST_FIELD_IDS, PROJECT_THEMES } from '../../common/constants';

export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({
    enum: PROJECT_THEMES,
    description: 'Named theme id applied to this project',
  })
  @IsOptional()
  @IsIn([...PROJECT_THEMES])
  theme?: (typeof PROJECT_THEMES)[number];

  @ApiPropertyOptional({
    enum: BoardLayout,
    description: 'Board layout preference: columns (Kanban) or list',
  })
  @IsOptional()
  @IsEnum(BoardLayout)
  boardLayout?: BoardLayout;

  @ApiPropertyOptional({
    type: [String],
    description: 'Visible Monday-list table field ids',
    example: ['key', 'title', 'priority', 'humanEffort', 'locEffort'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn([...LIST_FIELD_IDS], { each: true })
  listFields?: string[];
}
