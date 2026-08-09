import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class MoveIssueDto {
  @ApiProperty({ description: 'Target column id' })
  @IsString()
  columnId!: string;

  @ApiPropertyOptional({
    description: 'Place immediately before this issue (same column after move)',
  })
  @IsOptional()
  @IsString()
  beforeIssueId?: string;

  @ApiPropertyOptional({
    description: 'Place immediately after this issue (same column after move)',
  })
  @IsOptional()
  @IsString()
  afterIssueId?: string;
}
