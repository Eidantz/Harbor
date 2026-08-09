import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateColumnDto {
  @ApiProperty({ example: 'Review' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({
    description: 'Mark as the Done column (at most one per project)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDone?: boolean;

  @ApiPropertyOptional({
    example: '#7aa2f7',
    description: 'Hex accent color for column outline; null clears',
  })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string | null;
}
