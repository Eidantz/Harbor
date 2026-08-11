import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { BoardIssue, EpicSummary, IssueListItem } from '../api/types';
import { formatDueDate, isOverdue } from '../lib/format';
import { EpicBadge } from './EpicBadge';
import { PriorityBadge } from './PriorityBadge';
import { TypeBadge } from './TypeBadge';

type CardIssue = BoardIssue | IssueListItem;

export type OpenIssueOptions = { tab?: 'links' | 'details' };

function labelsOf(issue: CardIssue) {
  return issue.labels?.map((l) => l.label) ?? [];
}

function subtaskCount(issue: CardIssue) {
  return issue._count?.subtasks ?? 0;
}

function blockerHints(issue: CardIssue) {
  const count = issue._count as { linksTo?: number } | undefined;
  return count?.linksTo ?? 0;
}

function humanEffortOf(issue: CardIssue) {
  return 'humanEffort' in issue ? (issue.humanEffort ?? null) : null;
}

function locEffortOf(issue: CardIssue) {
  return 'locEffort' in issue ? (issue.locEffort ?? null) : null;
}

function epicOf(issue: CardIssue): EpicSummary | null {
  if ('epic' in issue && issue.epic) return issue.epic;
  return null;
}

function dueDateOf(issue: CardIssue) {
  return 'dueDate' in issue ? (issue.dueDate ?? null) : null;
}

export function IssueCard({
  issue,
  onOpen,
  draggable = false,
  inDoneColumn = false,
}: {
  issue: CardIssue;
  onOpen: (id: string, options?: OpenIssueOptions) => void;
  draggable?: boolean;
  inDoneColumn?: boolean;
}) {
  const sortable = useSortable({
    id: issue.id,
    disabled: !draggable,
    data: { issue, columnId: issue.columnId },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.45 : 1,
  };

  const labels = labelsOf(issue);
  const subs = subtaskCount(issue);
  const blocked = blockerHints(issue);
  const humanEffort = humanEffortOf(issue);
  const locEffort = locEffortOf(issue);
  const epic = epicOf(issue);
  const dueDate = dueDateOf(issue);
  const overdue = !inDoneColumn && isOverdue(dueDate);

  const openDetails = () => onOpen(issue.id);
  const onHitKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDetails();
    }
  };

  return (
    <article
      ref={sortable.setNodeRef}
      style={style}
      className={`issue-card${sortable.isDragging ? ' is-dragging' : ''}`}
      {...(draggable ? sortable.attributes : {})}
      {...(draggable ? sortable.listeners : {})}
    >
      <div
        className="issue-card-hit"
        role="button"
        tabIndex={0}
        onClick={openDetails}
        onKeyDown={onHitKey}
      >
        <div className="issue-card-top">
          <span className="issue-key">{issue.key}</span>
          <span className="issue-card-top-right">
            {epic ? <EpicBadge epic={epic} className="epic-badge-card" /> : null}
            <PriorityBadge priority={issue.priority} />
          </span>
        </div>
        <h4 className="issue-card-title">{issue.title}</h4>
        <div className="issue-card-meta">
          <TypeBadge type={issue.type} />
          {humanEffort != null ? (
            <span className="meta-chip" title="Human effort (hours)">
              {humanEffort}h
            </span>
          ) : null}
          {locEffort != null ? (
            <span className="meta-chip" title="LOC effort">
              {locEffort} loc
            </span>
          ) : null}
          {dueDate ? (
            <span
              className={`meta-chip${overdue ? ' overdue' : ''}`}
              title={overdue ? 'Overdue' : 'Due date'}
            >
              ⏱ {formatDueDate(dueDate)}
            </span>
          ) : null}
          {labels.slice(0, 3).map((l) => (
            <span
              key={l.id}
              className="label-chip"
              style={{ ['--label-color' as string]: l.color }}
            >
              {l.name}
            </span>
          ))}
          {subs > 0 ? (
            <span className="meta-chip" title="Subtasks">
              ▤ {subs}
            </span>
          ) : null}
          {blocked > 0 ? (
            <button
              type="button"
              className="meta-chip warn"
              title="View blockers"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onOpen(issue.id, { tab: 'links' });
              }}
            >
              ⊘ {blocked}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function IssueCardOverlay({ issue }: { issue: CardIssue }) {
  const epic = epicOf(issue);
  return (
    <article className="issue-card issue-card-overlay">
      <div className="issue-card-top">
        <span className="issue-key">{issue.key}</span>
        <span className="issue-card-top-right">
          {epic ? <EpicBadge epic={epic} className="epic-badge-card" /> : null}
          <PriorityBadge priority={issue.priority} />
        </span>
      </div>
      <h4 className="issue-card-title">{issue.title}</h4>
      <div className="issue-card-meta">
        <TypeBadge type={issue.type} />
      </div>
    </article>
  );
}
