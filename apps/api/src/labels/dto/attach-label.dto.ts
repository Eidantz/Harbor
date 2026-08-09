import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AttachLabelDto {
  @ApiProperty()
  @IsString()
  labelId!: string;
}
