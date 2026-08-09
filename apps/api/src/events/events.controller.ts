import {
  Controller,
  Header,
  type MessageEvent,
  Param,
  Sse,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { interval, map, merge, type Observable } from 'rxjs';
import { EventsService } from './events.service';

/** Keep-alive period; below common proxy read timeouts (nginx default 60s). */
const HEARTBEAT_MS = 25_000;

@ApiTags('events')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('projects')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Sse(':projectId/events')
  @Header('X-Accel-Buffering', 'no')
  @ApiOperation({
    summary:
      'SSE stream of board_changed events for a project (plus periodic pings)',
  })
  stream(@Param('projectId') projectId: string): Observable<MessageEvent> {
    return merge(
      this.events.forProject(projectId).pipe(map((e) => ({ data: e }))),
      interval(HEARTBEAT_MS).pipe(map(() => ({ data: { type: 'ping' } }))),
    );
  }
}
