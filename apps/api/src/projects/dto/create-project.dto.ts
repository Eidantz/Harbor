import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BoardLayout } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PROJECT_THEMES } from '../../common/constants';

export class CreateProjectDto {
  @ApiProperty({ example: 'My Project' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    example: 'MY',
    description: 'Uppercase project key used in issue keys (e.g. MY-1)',
  })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9]{1,9}$/, {
    message: 'key must be 2–10 chars, start with a letter, A–Z / 0–9 only',
  })
  key!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    enum: PROJECT_THEMES,
    default: 'tokyo-night',
    description: 'Named theme id applied to this project',
  })
  @IsOptional()
  @IsIn([...PROJECT_THEMES])
  theme?: (typeof PROJECT_THEMES)[number];

  @ApiPropertyOptional({
    enum: BoardLayout,
    default: BoardLayout.columns,
    description: 'Board layout preference: columns (Kanban) or list',
  })
  @IsOptional()
  @IsEnum(BoardLayout)
  boardLayout?: BoardLayout;
}
