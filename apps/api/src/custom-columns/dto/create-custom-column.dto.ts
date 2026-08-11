import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CUSTOM_COLUMN_TYPES } from '../custom-columns.types';
import type { CustomColumnType } from '@prisma/client';

export class CreateCustomColumnDto {
  @ApiProperty({ example: 'Task Category' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @ApiProperty({ enum: CUSTOM_COLUMN_TYPES, example: 'label' })
  @IsIn([...CUSTOM_COLUMN_TYPES])
  type!: CustomColumnType;

  @ApiPropertyOptional({
    description: 'Type-specific config, e.g. { options: [{ id, name, color }] } for label columns',
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
