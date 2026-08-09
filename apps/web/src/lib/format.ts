import type { ActivityType, IssuePriority, IssueType } from '../api/types';

export const PRIORITY_ORDER: IssuePriority[] = [
  'lowest',
  'low',
  'medium',
  'high',
  'highest',
];

export function priorityLabel(p: IssuePriority) {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export function typeLabel(t: IssueType) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function formatRelative(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** ISO datetime → value for <input type="date"> (YYYY-MM-DD), or ''. */
export function toDateInputValue(iso: string | null | undefined) {
  return iso ? iso.slice(0, 10) : '';
}

export function formatDueDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** Due strictly before today (dates compared in UTC, matching storage). */
export function isOverdue(iso: string | null | undefined) {
  if (!iso) return false;
  const today = new Date().toISOString().slice(0, 10);
  return iso.slice(0, 10) < today;
}

export function activityLabel(type: ActivityType) {
  switch (type) {
    case 'created':
      return 'Created';
    case 'updated':
      return 'Updated';
    case 'moved':
      return 'Moved';
    case 'linked':
      return 'Link changed';
    case 'commented':
      return 'Commented';
    default:
      return type;
  }
}
