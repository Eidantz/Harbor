import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTextAttachmentDto {
  @ApiProperty({ description: 'File content (markdown or plain text)' })
  @IsString()
  @MinLength(1)
  @MaxLength(100000)
  content!: string;

  @ApiPropertyOptional({
    description: 'Filename; defaults to plan.md (.md appended when no extension)',
    example: 'plan.md',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  filename?: string;
}
