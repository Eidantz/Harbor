import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';

@Module({
  imports: [ActivityModule],
  controllers: [LinksController],
  providers: [LinksService],
  exports: [LinksService],
})
export class LinksModule {}
