import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ReorderColumnsDto {
  @ApiProperty({
    type: [String],
    description: 'Column ids in the desired order (must include every column in the project)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  columnIds!: string[];
}
