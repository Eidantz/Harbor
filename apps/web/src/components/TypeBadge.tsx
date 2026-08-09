import type { IssueType } from '../api/types';
import { typeLabel } from '../lib/format';

export function TypeBadge({ type }: { type: IssueType }) {
  return (
    <span className={`type-badge type-${type}`} title={typeLabel(type)}>
      {type === 'bug' ? '●' : type === 'story' ? '◆' : '■'}
      <span>{typeLabel(type)}</span>
    </span>
  );
}
