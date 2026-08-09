import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateEpicDto {
  @ApiProperty({ example: 'Auth overhaul' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ description: 'Short summary (plain text)' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiPropertyOptional({ description: 'Long-form markdown plan/spec document' })
  @IsOptional()
  @IsString()
  @MaxLength(100000)
  document?: string;

  @ApiPropertyOptional({ example: '#7aa2f7' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a #RRGGBB hex' })
  color?: string;
}
