import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { CustomColumnsController } from './custom-columns.controller';
import { CustomColumnsService } from './custom-columns.service';

@Module({
  imports: [ActivityModule],
  controllers: [CustomColumnsController],
  providers: [CustomColumnsService],
  exports: [CustomColumnsService],
})
export class CustomColumnsModule {}
