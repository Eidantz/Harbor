import { Module } from '@nestjs/common';
import { ActivityModule } from './activity/activity.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuthModule } from './auth/auth.module';
import { ColumnsModule } from './columns/columns.module';
import { CommentsModule } from './comments/comments.module';
import { CustomColumnsModule } from './custom-columns/custom-columns.module';
import { EpicsModule } from './epics/epics.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { IssuesModule } from './issues/issues.module';
import { LabelsModule } from './labels/labels.module';
import { LinksModule } from './links/links.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    EventsModule,
    ProjectsModule,
    ColumnsModule,
    IssuesModule,
    LinksModule,
    AttachmentsModule,
    LabelsModule,
    CustomColumnsModule,
    EpicsModule,
    CommentsModule,
    ActivityModule,
    SearchModule,
  ],
})
export class AppModule {}
