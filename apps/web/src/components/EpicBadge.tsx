import type { CSSProperties } from 'react';
import type { EpicSummary } from '../api/types';
import { contrastForeground } from '../lib/color';

export function EpicBadge({
  epic,
  className,
}: {
  epic: EpicSummary;
  className?: string;
}) {
  const style = {
    backgroundColor: epic.color,
    color: contrastForeground(epic.color),
  } satisfies CSSProperties;

  return (
    <span
      className={`epic-badge${className ? ` ${className}` : ''}`}
      style={style}
      title={epic.name}
    >
      {epic.name}
    </span>
  );
}
