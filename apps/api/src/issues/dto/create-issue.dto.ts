import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IssuePriority, IssueType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateIssueDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @ApiPropertyOptional({ enum: IssueType, default: IssueType.task })
  @IsOptional()
  @IsEnum(IssueType)
  type?: IssueType;

  @ApiPropertyOptional({ enum: IssuePriority, default: IssuePriority.medium })
  @IsOptional()
  @IsEnum(IssuePriority)
  priority?: IssuePriority;

  @ApiPropertyOptional({ description: 'Human effort estimate in hours' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(0)
  humanEffort?: number | null;

  @ApiPropertyOptional({ description: 'Lines-of-code effort estimate' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(0)
  locEffort?: number | null;

  @ApiPropertyOptional({
    description: 'Target completion date (ISO 8601, e.g. 2026-08-31)',
  })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional({ description: 'Column id; defaults to first column (To Do)' })
  @IsOptional()
  @IsString()
  columnId?: string;

  @ApiPropertyOptional({ description: 'Parent issue id for subtasks' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({
    description: 'Epic id for top-level issues only; ignored/rejected with parentId',
  })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  epicId?: string | null;

  @ApiPropertyOptional({ description: 'Assignee user id; defaults to current user' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  assigneeId?: string | null;
}
