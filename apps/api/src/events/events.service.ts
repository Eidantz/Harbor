import { Injectable } from '@nestjs/common';
import { filter, type Observable, Subject } from 'rxjs';

export type BoardEventSource =
  | 'issue'
  | 'column'
  | 'link'
  | 'comment'
  | 'attachment'
  | 'label'
  | 'project';

export interface BoardEvent {
  type: 'board_changed';
  projectId: string;
  source: BoardEventSource;
  at: string;
}

/**
 * In-process pub/sub for board mutations. Mutating services emit after each
 * change; the SSE controller fans events out to connected browsers so boards
 * refresh live (e.g. while an MCP agent works the board).
 */
@Injectable()
export class EventsService {
  private readonly events$ = new Subject<BoardEvent>();

  emit(projectId: string, source: BoardEventSource) {
    this.events$.next({
      type: 'board_changed',
      projectId,
      source,
      at: new Date().toISOString(),
    });
  }

  forProject(projectId: string): Observable<BoardEvent> {
    return this.events$.pipe(filter((e) => e.projectId === projectId));
  }
}
