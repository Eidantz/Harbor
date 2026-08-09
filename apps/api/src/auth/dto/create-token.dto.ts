import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTokenDto {
  @ApiPropertyOptional({
    example: 'Cursor MCP',
    description: 'Label for this token (defaults to "MCP")',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;
}
