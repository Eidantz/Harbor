import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, ValidateIf } from 'class-validator';

export class SetCustomValueDto {
  @ApiPropertyOptional({
    description:
      'Cell value, shape depends on column type: { text } | { number } | { date } | { optionId } | { userId } | { attachmentId, filename } | { checked }. Send null to clear.',
    nullable: true,
    example: { text: 'hello' },
  })
  @ValidateIf((_, v) => v !== null)
  @IsObject()
  value!: Record<string, unknown> | null;
}
