import type { IssuePriority } from '../api/types';
import { priorityLabel } from '../lib/format';

export function PriorityBadge({ priority }: { priority: IssuePriority }) {
  return (
    <span className={`priority-badge priority-${priority}`} title={priorityLabel(priority)}>
      <span className="priority-bars" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span className="sr-only">{priorityLabel(priority)}</span>
    </span>
  );
}
