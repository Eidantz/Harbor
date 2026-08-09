import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateEpicDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ description: 'Short summary (plain text); null clears' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(300)
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Long-form markdown plan/spec document; null clears',
  })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(100000)
  document?: string | null;

  @ApiPropertyOptional({ example: '#7aa2f7' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a #RRGGBB hex' })
  color?: string;

  @ApiPropertyOptional({ description: 'List order position (0-based)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
