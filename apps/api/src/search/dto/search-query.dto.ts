import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Max, Min, MinLength } from 'class-validator';
import { IsOptional } from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({ description: 'Search text (title, key, description)' })
  @IsString()
  @MinLength(1)
  q!: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
