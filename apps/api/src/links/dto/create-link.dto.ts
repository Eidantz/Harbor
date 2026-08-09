import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IssueLinkType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateLinkDto {
  @ApiProperty({
    description:
      'Issue that is blocked (this endpoint’s issue is the blocker / source)',
  })
  @IsString()
  targetId!: string;

  @ApiPropertyOptional({
    enum: IssueLinkType,
    default: IssueLinkType.blocks,
    description:
      'blocks: source blocks target; relates_to: symmetric relation; duplicates: source duplicates target',
  })
  @IsOptional()
  @IsEnum(IssueLinkType)
  type?: IssueLinkType;
}
