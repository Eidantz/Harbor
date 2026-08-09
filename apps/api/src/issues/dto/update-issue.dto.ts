import { ApiPropertyOptional } from '@nestjs/swagger';
import { IssuePriority, IssueType } from '@prisma/client';
import {
  IsBoolean,
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

export class UpdateIssueDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title?: string;

  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @ApiPropertyOptional({ enum: IssueType })
  @IsOptional()
  @IsEnum(IssueType)
  type?: IssueType;

  @ApiPropertyOptional({ enum: IssuePriority })
  @IsOptional()
  @IsEnum(IssuePriority)
  priority?: IssuePriority;

  @ApiPropertyOptional({ description: 'Human effort estimate in hours; null clears' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(0)
  humanEffort?: number | null;

  @ApiPropertyOptional({ description: 'Lines-of-code effort estimate; null clears' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(0)
  locEffort?: number | null;

  @ApiPropertyOptional({
    description: 'Target completion date (ISO 8601); null clears',
  })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional({
    description:
      'true archives the issue (hidden from board, restorable); false restores it',
  })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  assigneeId?: string | null;

  @ApiPropertyOptional({
    description: 'Epic id for top-level issues; null clears. Rejected for subtasks.',
  })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  epicId?: string | null;
}
