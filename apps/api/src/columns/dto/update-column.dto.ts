import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateColumnDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({
    description: 'New position (0-based). Other columns are shifted to keep positions unique.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({
    description: 'Mark as the Done column (at most one per project). Setting true clears others.',
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
