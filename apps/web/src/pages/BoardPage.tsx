import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type {
  BoardColumn,
  BoardColumnWithIssues,
  BoardIssue,
  BoardLayout,
  CustomColumn,
  CustomColumnType,
  CustomValuePayload,
  Epic,
  IssueListItem,
  IssuePriority,
  IssueType,
  Label,
  ListFieldId,
  ProjectTheme,
  User,
} from '../api/types';
import { ApiError, DEFAULT_LIST_FIELDS } from '../api/types';
import { ColorPicker } from '../components/ColorPicker';
import { CustomCell, type CustomCellHandlers } from '../components/CustomCell';
import { EpicBadge } from '../components/EpicBadge';
import { LabelCell, nextLabelName, type LabelActions } from '../components/LabelCell';
import {
  AddColumnMenu,
  COLUMN_TYPE_OPTIONS,
  HeaderMenu,
  ResizeHandle,
} from '../components/ListHeaderControls';
import { PickerCell } from '../components/PickerCell';
import { IssueCard, IssueCardOverlay, type OpenIssueOptions } from '../components/IssueCard';
import { IssueDrawer, type DrawerTab } from '../components/IssueDrawer';
import { EmptyState, Loading } from '../components/Loading';
import { TypeBadge } from '../components/TypeBadge';
import { useToast } from '../components/Toast';
import {
  formatRelative,
  isOverdue,
  PRIORITY_ORDER,
  toDateInputValue,
} from '../lib/format';
import {
  DEFAULT_THEME,
  PROJECT_THEMES,
  THEME_LABELS,
  applyDocumentTheme,
  isProjectTheme,
  themeColumnColor,
} from '../theme/themes';
import type { ProjectContext } from './ProjectLayout';

const LIST_FIELD_OPTIONS: { id: ListFieldId; label: string }[] = [
  { id: 'key', label: 'Key' },
  { id: 'title', label: 'Title' },
  { id: 'assignee', label: 'Owner' },
  { id: 'epic', label: 'Epic' },
  { id: 'status', label: 'Status' },
  { id: 'document', label: 'Markdown' },
  { id: 'description', label: 'Description' },
  { id: 'priority', label: 'Priority' },
  { id: 'humanEffort', label: 'Human (h)' },
  { id: 'locEffort', label: 'LOC' },
  { id: 'dueDate', label: 'Due' },
  { id: 'type', label: 'Type' },
  { id: 'labels', label: 'Labels' },
  { id: 'blockers', label: 'Blockers' },
];

/** Default pixel widths for built-in fields (used until the user resizes). */
const DEFAULT_FIELD_WIDTHS: Record<ListFieldId, number> = {
  key: 90,
  title: 320,
  assignee: 80,
  epic: 150,
  status: 150,
  document: 100,
  description: 220,
  priority: 130,
  humanEffort: 100,
  locEffort: 90,
  dueDate: 140,
  type: 90,
  labels: 170,
  blockers: 100,
};

/** Default pixel widths per custom column type. */
const DEFAULT_TYPE_WIDTHS: Record<CustomColumnType, number> = {
  text: 200,
  number: 110,
  date: 140,
  label: 150,
  person: 90,
  file: 170,
  checkbox: 80,
};

const ADD_COLUMN_WIDTH = 44;
const SELECT_COLUMN_WIDTH = 52;

/** Everything the list table needs for custom columns, resizing, selection. */
type ListTableExtras = {
  customColumns: CustomColumn[];
  users: User[];
  customHandlers: CustomCellHandlers;
  widths: Record<string, number>;
  onLiveWidth: (id: string, w: number) => void;
  onCommitWidth: (id: string, w: number) => void;
  onAddColumn: (type: CustomColumnType) => void;
  onRenameCustomColumn: (columnId: string, name: string) => Promise<void>;
  onDeleteCustomColumn: (column: CustomColumn) => Promise<void>;
  onHideField: (id: ListFieldId) => void;
  selectedIds: ReadonlySet<string>;
  onToggleSelect: (issueId: string, selected: boolean) => void;
  onToggleSelectMany: (issueIds: string[], selected: boolean) => void;
  onAddSubtask: (parentId: string, title: string) => Promise<void>;
};

/** Section header checkbox with indeterminate support. */
function SectionSelectAll({
  issueIds,
  selectedIds,
  onToggle,
}: {
  issueIds: string[];
  selectedIds: ReadonlySet<string>;
  onToggle: (issueIds: string[], selected: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const selectedCount = issueIds.filter((id) => selectedIds.has(id)).length;
  const all = issueIds.length > 0 && selectedCount === issueIds.length;

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = selectedCount > 0 && !all;
    }
  }, [selectedCount, all]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className="monday-checkbox"
      checked={all}
      disabled={issueIds.length === 0}
      aria-label="Select all issues in this section"
      onChange={(e) => onToggle(issueIds, e.target.checked)}
    />
  );
}

/**
 * Draggable list row: drag starts from the grip in the select cell only, so
 * inputs and pickers inside the row keep working normally.
 */
function DraggableIssueRow({
  issue,
  selected,
  children,
}: {
  issue: BoardIssue;
  selected: boolean;
  children: (grip: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `row-${issue.id}`,
    data: { type: 'list-row', issueId: issue.id },
  });

  const grip = (
    <button
      type="button"
      className="row-grip"
      title="Drag to move"
      aria-label={`Drag ${issue.key}`}
      {...attributes}
      {...listeners}
    >
      ⋮⋮
    </button>
  );

  return (
    <tr
      ref={setNodeRef}
      className={`${selected ? 'is-selected' : ''}${isDragging ? ' is-row-dragging' : ''}`}
    >
      {children(grip)}
    </tr>
  );
}

/** Apply fn to every board issue, including nested subtasks. */
function mapBoardIssues(
  cols: BoardColumnWithIssues[],
  fn: (issue: BoardIssue) => BoardIssue,
): BoardColumnWithIssues[] {
  return cols.map((c) => ({
    ...c,
    issues: c.issues.map((i) => {
      const mapped = fn(i);
      return mapped.subtasks
        ? { ...mapped, subtasks: mapped.subtasks.map(fn) }
        : mapped;
    }),
  }));
}

function normalizeListFields(raw: ProjectContext['project']['listFields']): ListFieldId[] {
  const allowed = new Set<string>(DEFAULT_LIST_FIELDS);
  const fromProject = (raw ?? []).filter((f): f is ListFieldId => allowed.has(f));
  if (fromProject.length === 0) return [...DEFAULT_LIST_FIELDS];
  if (!fromProject.includes('title')) return ['title', ...fromProject];
  return fromProject;
}

function ColumnOverflowMenu({
  column,
  busy,
  canDelete,
  onRename,
  onToggleDone,
  onDelete,
}: {
  column: BoardColumnWithIssues;
  busy: boolean;
  canDelete: boolean;
  onRename: () => void;
  onToggleDone: (columnId: string, isDone: boolean) => Promise<void>;
  onDelete: (columnId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="column-menu" ref={rootRef}>
      <button
        type="button"
        className="icon-btn tiny-icon"
        disabled={busy}
        title="Column menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open ? (
        <ul className="column-menu-popover" role="menu">
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onRename();
              }}
            >
              Rename
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                void onToggleDone(column.id, !column.isDone);
              }}
            >
              {column.isDone ? 'Clear done column' : 'Use as done column'}
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="danger"
              disabled={!canDelete || busy || column.issues.length > 0}
              title={
                column.issues.length > 0
                  ? 'Only empty columns can be deleted'
                  : 'Delete column'
              }
              onClick={() => {
                setOpen(false);
                void onDelete(column.id);
              }}
            >
              Delete
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

type ListSortKey =
  | 'key'
  | 'title'
  | 'priority'
  | 'humanEffort'
  | 'locEffort'
  | 'dueDate'
  | 'type';

const PRIORITY_RANK: Record<IssuePriority, number> = {
  lowest: 0,
  low: 1,
  medium: 2,
  high: 3,
  highest: 4,
};

const TYPE_RANK: Record<IssueType, number> = {
  bug: 0,
  task: 1,
  story: 2,
};

type IssueRowSharedProps = {
  fields: ListFieldId[];
  labels: Label[];
  labelActions: LabelActions;
  epics: Epic[];
  allColumns: BoardColumn[];
  extras: ListTableExtras;
  columnIsDone: boolean;
  onMoveColumn: (issueId: string, columnId: string) => Promise<void>;
  onSetEpic: (issueId: string, epicId: string | null) => Promise<void>;
  onOpen: (id: string, options?: OpenIssueOptions) => void;
  onPatchIssue: (
    issueId: string,
    patch: {
      priority?: IssuePriority;
      humanEffort?: number | null;
      locEffort?: number | null;
      dueDate?: string | null;
      description?: string | null;
    },
  ) => Promise<void>;
};

/** All data cells of a list row; shared between parent and subtask rows. */
function IssueRowCells({
  issue,
  isSubtask = false,
  caret,
  fields,
  labels,
  labelActions,
  epics,
  allColumns,
  extras,
  columnIsDone,
  onMoveColumn,
  onSetEpic,
  onOpen,
  onPatchIssue,
}: IssueRowSharedProps & {
  issue: BoardIssue;
  isSubtask?: boolean;
  /** Expand/collapse control rendered before the title (parents only). */
  caret?: ReactNode;
}) {
  const show = (id: ListFieldId) => fields.includes(id);
  const blocked = issue._count?.linksTo ?? 0;

  return (
    <>
      {show('key') ? (
        <td>
          <span className="issue-key">{issue.key}</span>
        </td>
      ) : null}
      {show('title') ? (
        <td>
          <div className={`monday-title-cell${isSubtask ? ' is-subtask-title' : ''}`}>
            {isSubtask ? (
              <span className="subtask-arrow" aria-hidden>
                ↳
              </span>
            ) : null}
            {caret}
            <button
              type="button"
              className="monday-title-btn"
              onClick={() => onOpen(issue.id)}
            >
              {issue.title}
            </button>
            {issue.epic && !show('epic') ? <EpicBadge epic={issue.epic} /> : null}
          </div>
        </td>
      ) : null}
      {show('assignee') ? (
        <td>
          {issue.assignee ? (
            <span className="owner-avatar" title={issue.assignee.email}>
              {issue.assignee.email.slice(0, 1).toUpperCase()}
            </span>
          ) : (
            <span className="owner-avatar empty" title="Unassigned" aria-hidden>
              ●
            </span>
          )}
        </td>
      ) : null}
      {show('epic') ? (
        <td className="monday-cell-labels">
          {isSubtask ? (
            <span className="muted">—</span>
          ) : (
            <PickerCell
              value={issue.epic?.id ?? null}
              options={epics.map((e) => ({
                id: e.id,
                name: e.name,
                color: e.color,
              }))}
              ariaLabel={`Epic for ${issue.key}`}
              clearLabel="Remove from epic"
              onSelect={(id) => void onSetEpic(issue.id, id)}
            />
          )}
        </td>
      ) : null}
      {show('status') ? (
        <td className="monday-cell-labels">
          <PickerCell
            value={issue.columnId}
            options={allColumns.map((c) => ({
              id: c.id,
              name: c.name,
              color: c.color,
            }))}
            ariaLabel={`Status for ${issue.key}`}
            onSelect={(id) => {
              if (id) void onMoveColumn(issue.id, id);
            }}
          />
        </td>
      ) : null}
      {show('document') ? (
        <td>
          {issue.document ? (
            <button
              type="button"
              className="doc-chip"
              title="Open document"
              aria-label={`Open document for ${issue.key}`}
              onClick={() => onOpen(issue.id, { tab: 'details' })}
            >
              📄
            </button>
          ) : (
            <span className="muted">—</span>
          )}
        </td>
      ) : null}
      {show('description') ? (
        <td>
          <input
            className="monday-cell-input monday-description-input"
            type="text"
            placeholder="—"
            maxLength={2000}
            defaultValue={issue.description ?? ''}
            key={`${issue.id}-d-${issue.description ?? 'x'}`}
            aria-label={`Description for ${issue.key}`}
            onBlur={(e) => {
              const next = e.target.value.trim() || null;
              if (next === (issue.description ?? null)) return;
              void onPatchIssue(issue.id, { description: next });
            }}
          />
        </td>
      ) : null}
      {show('priority') ? (
        <td className="monday-cell-priority">
          <select
            className="monday-cell-select monday-priority-select"
            value={issue.priority}
            aria-label={`Priority for ${issue.key}`}
            onChange={(e) =>
              void onPatchIssue(issue.id, {
                priority: e.target.value as IssuePriority,
              })
            }
          >
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </td>
      ) : null}
      {show('humanEffort') ? (
        <td>
          <input
            className="monday-cell-input"
            type="number"
            min={0}
            step={0.5}
            placeholder="—"
            defaultValue={issue.humanEffort ?? ''}
            key={`${issue.id}-h-${issue.humanEffort ?? 'x'}`}
            aria-label={`Human effort for ${issue.key}`}
            onBlur={(e) => {
              const raw = e.target.value.trim();
              const next = raw === '' ? null : Number(raw);
              if (raw !== '' && Number.isNaN(next)) return;
              if (next === issue.humanEffort) return;
              void onPatchIssue(issue.id, { humanEffort: next });
            }}
          />
        </td>
      ) : null}
      {show('locEffort') ? (
        <td>
          <input
            className="monday-cell-input"
            type="number"
            min={0}
            step={1}
            placeholder="—"
            defaultValue={issue.locEffort ?? ''}
            key={`${issue.id}-loc-${issue.locEffort ?? 'x'}`}
            aria-label={`LOC effort for ${issue.key}`}
            onBlur={(e) => {
              const raw = e.target.value.trim();
              const next = raw === '' ? null : Math.round(Number(raw));
              if (raw !== '' && Number.isNaN(next)) return;
              if (next === issue.locEffort) return;
              void onPatchIssue(issue.id, { locEffort: next });
            }}
          />
        </td>
      ) : null}
      {show('dueDate') ? (
        <td>
          <input
            className={`monday-cell-input monday-date-input${
              !columnIsDone && isOverdue(issue.dueDate) ? ' overdue' : ''
            }`}
            type="date"
            value={toDateInputValue(issue.dueDate)}
            aria-label={`Due date for ${issue.key}`}
            onChange={(e) => {
              const next = e.target.value;
              if (next === toDateInputValue(issue.dueDate)) return;
              void onPatchIssue(issue.id, { dueDate: next || null });
            }}
          />
        </td>
      ) : null}
      {show('type') ? (
        <td>
          <TypeBadge type={issue.type} />
        </td>
      ) : null}
      {show('labels') ? (
        <td className="monday-cell-labels">
          <LabelCell issue={issue} labels={labels} actions={labelActions} />
        </td>
      ) : null}
      {show('blockers') ? (
        <td>
          {blocked > 0 ? (
            <button
              type="button"
              className="meta-chip warn"
              onClick={() => onOpen(issue.id, { tab: 'links' })}
            >
              ⊘ {blocked}
            </button>
          ) : (
            <span className="muted">—</span>
          )}
        </td>
      ) : null}
      {extras.customColumns.map((c) => (
        <td
          key={c.id}
          className={
            c.type === 'label' || c.type === 'person'
              ? 'monday-cell-labels'
              : undefined
          }
        >
          <CustomCell
            issue={issue}
            column={c}
            users={extras.users}
            handlers={extras.customHandlers}
          />
        </td>
      ))}
    </>
  );
}

function ListIssueTable({
  column,
  fields,
  labels,
  labelActions,
  epics,
  allColumns,
  extras,
  onMoveColumn,
  onSetEpic,
  onOpen,
  onPatchIssue,
}: {
  column: BoardColumnWithIssues;
  fields: ListFieldId[];
  labels: Label[];
  labelActions: LabelActions;
  epics: Epic[];
  allColumns: BoardColumn[];
  extras: ListTableExtras;
  onMoveColumn: (issueId: string, columnId: string) => Promise<void>;
  onSetEpic: (issueId: string, epicId: string | null) => Promise<void>;
  onOpen: (id: string, options?: OpenIssueOptions) => void;
  onPatchIssue: (
    issueId: string,
    patch: {
      priority?: IssuePriority;
      humanEffort?: number | null;
      locEffort?: number | null;
      dueDate?: string | null;
      description?: string | null;
    },
  ) => Promise<void>;
}) {
  const show = (id: ListFieldId) => fields.includes(id);
  const [sortKey, setSortKey] = useState<ListSortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, string>>({});

  const toggleExpanded = (issueId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) next.delete(issueId);
      else next.add(issueId);
      return next;
    });

  const rowShared: IssueRowSharedProps = {
    fields,
    labels,
    labelActions,
    epics,
    allColumns,
    extras,
    columnIsDone: column.isDone,
    onMoveColumn,
    onSetEpic,
    onOpen,
    onPatchIssue,
  };

  const toggleSort = (key: ListSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedIssues = useMemo(() => {
    if (!sortKey) return column.issues;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...column.issues].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'key':
          cmp = a.key.localeCompare(b.key, undefined, { numeric: true });
          break;
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'priority':
          cmp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
          break;
        case 'humanEffort':
          cmp = (a.humanEffort ?? -1) - (b.humanEffort ?? -1);
          break;
        case 'locEffort':
          cmp = (a.locEffort ?? -1) - (b.locEffort ?? -1);
          break;
        case 'dueDate':
          cmp = (a.dueDate ?? '\uffff').localeCompare(b.dueDate ?? '\uffff');
          break;
        case 'type':
          cmp = TYPE_RANK[a.type] - TYPE_RANK[b.type];
          break;
      }
      return cmp * dir;
    });
  }, [column.issues, sortKey, sortDir]);

  const SORTABLE_FIELDS: Partial<Record<ListFieldId, ListSortKey>> = {
    key: 'key',
    title: 'title',
    priority: 'priority',
    humanEffort: 'humanEffort',
    locEffort: 'locEffort',
    dueDate: 'dueDate',
    type: 'type',
  };

  const visibleFields = LIST_FIELD_OPTIONS.filter((o) => show(o.id));
  const widthOfField = (id: ListFieldId) =>
    extras.widths[id] ?? DEFAULT_FIELD_WIDTHS[id];
  const widthOfCustom = (col: CustomColumn) =>
    extras.widths[col.id] ?? DEFAULT_TYPE_WIDTHS[col.type];
  const totalWidth =
    SELECT_COLUMN_WIDTH +
    visibleFields.reduce((sum, f) => sum + widthOfField(f.id), 0) +
    extras.customColumns.reduce((sum, c) => sum + widthOfCustom(c), 0) +
    ADD_COLUMN_WIDTH;
  const columnCount = visibleFields.length + extras.customColumns.length + 2;
  const sectionIssueIds = sortedIssues.map((i) => i.id);

  const headerLabel = (id: ListFieldId, label: string) => {
    const sortable = SORTABLE_FIELDS[id];
    if (!sortable) return <span className="monday-th-label">{label}</span>;
    return (
      <button
        type="button"
        className="monday-th-btn"
        onClick={() => toggleSort(sortable)}
        aria-label={`Sort by ${label}`}
      >
        {label}
        {sortKey === sortable ? (
          <span className="monday-sort-indicator" aria-hidden>
            {sortDir === 'asc' ? '▲' : '▼'}
          </span>
        ) : null}
      </button>
    );
  };

  const commitRenameColumn = (col: CustomColumn) => {
    const next = renameDraft.trim();
    setRenamingId(null);
    if (!next || next === col.name) return;
    void extras.onRenameCustomColumn(col.id, next);
  };

  return (
    <div className="monday-table-wrap">
      <table className="monday-table" style={{ width: totalWidth }}>
        <colgroup>
          <col style={{ width: SELECT_COLUMN_WIDTH }} />
          {visibleFields.map((f) => (
            <col key={f.id} style={{ width: widthOfField(f.id) }} />
          ))}
          {extras.customColumns.map((c) => (
            <col key={c.id} style={{ width: widthOfCustom(c) }} />
          ))}
          <col style={{ width: ADD_COLUMN_WIDTH }} />
        </colgroup>
        <thead>
          <tr>
            <th className="monday-th monday-th-select">
              <SectionSelectAll
                issueIds={sectionIssueIds}
                selectedIds={extras.selectedIds}
                onToggle={extras.onToggleSelectMany}
              />
            </th>
            {visibleFields.map((f) => (
              <th key={f.id} className="monday-th">
                <div className="monday-th-inner">
                  {headerLabel(f.id, f.label)}
                  {f.id !== 'title' ? (
                    <HeaderMenu
                      ariaLabel={`${f.label} column menu`}
                      items={[
                        { label: 'Hide column', onClick: () => extras.onHideField(f.id) },
                      ]}
                    />
                  ) : null}
                </div>
                <ResizeHandle
                  width={widthOfField(f.id)}
                  onLiveResize={(w) => extras.onLiveWidth(f.id, w)}
                  onCommit={(w) => extras.onCommitWidth(f.id, w)}
                />
              </th>
            ))}
            {extras.customColumns.map((c) => (
              <th key={c.id} className="monday-th">
                <div className="monday-th-inner">
                  {renamingId === c.id ? (
                    <input
                      className="monday-th-rename"
                      value={renameDraft}
                      autoFocus
                      maxLength={60}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={() => commitRenameColumn(c)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitRenameColumn(c);
                        } else if (e.key === 'Escape') {
                          setRenamingId(null);
                        }
                      }}
                    />
                  ) : (
                    <span className="monday-th-label" title={c.name}>
                      {c.name}
                    </span>
                  )}
                  <HeaderMenu
                    ariaLabel={`${c.name} column menu`}
                    items={[
                      {
                        label: 'Rename',
                        onClick: () => {
                          setRenameDraft(c.name);
                          setRenamingId(c.id);
                        },
                      },
                      {
                        label: 'Delete column',
                        danger: true,
                        onClick: () => void extras.onDeleteCustomColumn(c),
                      },
                    ]}
                  />
                </div>
                <ResizeHandle
                  width={widthOfCustom(c)}
                  onLiveResize={(w) => extras.onLiveWidth(c.id, w)}
                  onCommit={(w) => extras.onCommitWidth(c.id, w)}
                />
              </th>
            ))}
            <th className="monday-th monday-th-add">
              <AddColumnMenu onAdd={extras.onAddColumn} />
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedIssues.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className="muted">
                No issues
              </td>
            </tr>
          ) : (
            sortedIssues.map((issue) => {
              const selected = extras.selectedIds.has(issue.id);
              const subtasks = issue.subtasks ?? [];
              const subtaskCount = subtasks.length || (issue._count?.subtasks ?? 0);
              const isExpanded = expanded.has(issue.id);
              const draft = subtaskDrafts[issue.id] ?? '';
              return (
                <Fragment key={issue.id}>
                <DraggableIssueRow issue={issue} selected={selected}>
                  {(grip) => (
                    <>
                  <td className="monday-cell-select">
                    <span className="select-cell-inner">
                      {grip}
                      <input
                        type="checkbox"
                        className="monday-checkbox"
                        checked={selected}
                        aria-label={`Select ${issue.key}`}
                        onChange={(e) => extras.onToggleSelect(issue.id, e.target.checked)}
                      />
                    </span>
                  </td>
                  <IssueRowCells
                    issue={issue}
                    caret={
                      subtaskCount > 0 ? (
                        <button
                          type="button"
                          className="subtask-caret"
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} subtasks of ${issue.key}`}
                          onClick={() => toggleExpanded(issue.id)}
                        >
                          {isExpanded ? '▾' : '▸'} {subtaskCount}
                        </button>
                      ) : null
                    }
                    {...rowShared}
                  />
                  <td className="monday-td-add" aria-hidden />
                    </>
                  )}
                </DraggableIssueRow>
                {isExpanded
                  ? subtasks.map((sub) => (
                      <tr key={sub.id} className="is-subtask-row">
                        <td className="monday-cell-select" aria-hidden />
                        <IssueRowCells issue={sub} isSubtask {...rowShared} />
                        <td className="monday-td-add" aria-hidden />
                      </tr>
                    ))
                  : null}
                {isExpanded ? (
                  <tr className="is-subtask-row subtask-add-row">
                    <td aria-hidden />
                    <td colSpan={columnCount - 1}>
                      <form
                        className="subtask-add-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const title = draft.trim();
                          if (!title) return;
                          setSubtaskDrafts((prev) => ({ ...prev, [issue.id]: '' }));
                          void extras.onAddSubtask(issue.id, title);
                        }}
                      >
                        <span className="subtask-arrow" aria-hidden>
                          ↳
                        </span>
                        <input
                          value={draft}
                          maxLength={300}
                          placeholder="Add subtask…"
                          aria-label={`Add subtask to ${issue.key}`}
                          onChange={(e) =>
                            setSubtaskDrafts((prev) => ({
                              ...prev,
                              [issue.id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          type="submit"
                          className="btn btn-secondary btn-tiny"
                          disabled={!draft.trim()}
                        >
                          Add
                        </button>
                      </form>
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function ColumnDrop({
  column,
  accent,
  layout,
  collapsed,
  listFields,
  labels,
  labelActions,
  epics,
  allColumns,
  extras,
  onMoveColumn,
  onSetEpic,
  onToggleCollapse,
  onOpen,
  onRename,
  onToggleDone,
  onDelete,
  onColorChange,
  onPatchIssue,
  canDelete,
}: {
  column: BoardColumnWithIssues;
  /** Effective accent: stored color, or the theme default for its position. */
  accent: string;
  layout: BoardLayout;
  collapsed?: boolean;
  listFields: ListFieldId[];
  labels: Label[];
  labelActions: LabelActions;
  epics: Epic[];
  allColumns: BoardColumn[];
  extras: ListTableExtras;
  onMoveColumn: (issueId: string, columnId: string) => Promise<void>;
  onSetEpic: (issueId: string, epicId: string | null) => Promise<void>;
  onToggleCollapse?: () => void;
  onOpen: (id: string, options?: OpenIssueOptions) => void;
  onRename: (columnId: string, name: string) => Promise<void>;
  onToggleDone: (columnId: string, isDone: boolean) => Promise<void>;
  onDelete: (columnId: string) => Promise<void>;
  onColorChange: (columnId: string, color: string | null) => Promise<void>;
  onPatchIssue: (
    issueId: string,
    patch: {
      priority?: IssuePriority;
      humanEffort?: number | null;
      locEffort?: number | null;
      dueDate?: string | null;
      description?: string | null;
    },
  ) => Promise<void>;
  canDelete: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: { type: 'column', columnId: column.id },
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `drop-${column.id}`,
    data: { columnId: column.id, type: 'column-drop' },
  });

  const setNodeRef = (node: HTMLElement | null) => {
    setSortableRef(node);
    setDroppableRef(node);
  };

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(column.name);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(column.name);
  }, [column.name, editing]);

  const commitRename = async () => {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === column.name) {
      setDraft(column.name);
      return;
    }
    setBusy(true);
    try {
      await onRename(column.id, next);
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void commitRename();
    } else if (e.key === 'Escape') {
      setDraft(column.name);
      setEditing(false);
    }
  };

  const isList = layout === 'list';
  const sectionClass = [
    isList ? 'board-list-section' : 'board-column',
    isOver ? 'is-over' : '',
    isList && collapsed ? 'is-collapsed' : '',
    isDragging ? 'is-column-dragging' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    ['--col-accent' as string]: accent,
  };

  return (
    <section className={sectionClass} ref={setNodeRef} style={style}>
      <header className="board-column-header">
        <div className="board-column-title">
          <button
            type="button"
            className="column-grip"
            title="Drag to reorder"
            aria-label={`Reorder ${column.name}`}
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
          {isList ? (
            <button
              type="button"
              className="collapse-btn"
              aria-expanded={!collapsed}
              onClick={onToggleCollapse}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? '▸' : '▾'}
            </button>
          ) : null}
          {editing ? (
            <input
              className="column-name-input"
              value={draft}
              autoFocus
              disabled={busy}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void commitRename()}
              onKeyDown={onKeyDown}
              maxLength={80}
            />
          ) : (
            <button
              type="button"
              className="column-name-btn"
              onClick={() => setEditing(true)}
              title="Rename column"
            >
              <h2>{column.name}</h2>
            </button>
          )}
          <span className="count-pill">{column.issues.length}</span>
        </div>
        <div className="column-actions">
          <ColorPicker
            value={column.color ?? accent}
            disabled={busy}
            onChange={(color) => void onColorChange(column.id, color)}
          />
          <ColumnOverflowMenu
            column={column}
            busy={busy}
            canDelete={canDelete}
            onRename={() => setEditing(true)}
            onToggleDone={onToggleDone}
            onDelete={onDelete}
          />
        </div>
      </header>
      {!collapsed ? (
        isList ? (
          <div className="board-list-body">
            <ListIssueTable
              column={column}
              fields={listFields}
              labels={labels}
              labelActions={labelActions}
              epics={epics}
              allColumns={allColumns}
              extras={extras}
              onMoveColumn={onMoveColumn}
              onSetEpic={onSetEpic}
              onOpen={onOpen}
              onPatchIssue={onPatchIssue}
            />
          </div>
        ) : (
          <SortableContext
            items={column.issues.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="board-column-body">
              {column.issues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  onOpen={onOpen}
                  inDoneColumn={column.isDone}
                  draggable
                />
              ))}
            </div>
          </SortableContext>
        )
      ) : null}
    </section>
  );
}

function ListFieldsMenu({
  fields,
  saving,
  onChange,
}: {
  fields: ListFieldId[];
  saving: boolean;
  onChange: (next: ListFieldId[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = new Set(fields);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggle = (id: ListFieldId) => {
    if (id === 'title') return;
    const next = LIST_FIELD_OPTIONS.map((o) => o.id).filter((fid) => {
      if (fid === id) return !selected.has(fid);
      return selected.has(fid);
    });
    if (!next.includes('title')) next.unshift('title');
    onChange(next);
  };

  return (
    <div className="list-fields-menu" ref={rootRef}>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={saving}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        Display
      </button>
      {open ? (
        <div className="list-fields-popover" role="dialog" aria-label="Show or hide fields">
          <div className="list-fields-popover-title">Show fields</div>
          {LIST_FIELD_OPTIONS.map((opt) => (
            <label key={opt.id} className="list-fields-option">
              <input
                type="checkbox"
                checked={selected.has(opt.id)}
                disabled={saving || opt.id === 'title'}
                onChange={() => toggle(opt.id)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BoardPage() {
  const { project, setProject, labels, epics, reloadMeta } =
    useOutletContext<ProjectContext>();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const issueId = searchParams.get('issue');
  const drawerTabParam = searchParams.get('tab');
  const drawerTab: DrawerTab | undefined =
    drawerTabParam === 'links' ||
    drawerTabParam === 'files' ||
    drawerTabParam === 'comments' ||
    drawerTabParam === 'activity' ||
    drawerTabParam === 'details'
      ? drawerTabParam
      : undefined;

  const [columns, setColumns] = useState<BoardColumnWithIssues[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draggingRowIds, setDraggingRowIds] = useState<string[] | null>(null);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [widths, setWidths] = useState<Record<string, number>>(
    () => project.listWidths ?? {},
  );
  const [loading, setLoading] = useState(true);
  const [activeIssue, setActiveIssue] = useState<BoardIssue | null>(null);
  const [draggingColumn, setDraggingColumn] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archived, setArchived] = useState<IssueListItem[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterType, setFilterType] = useState<'' | IssueType>('');
  const [filterPriority, setFilterPriority] = useState<'' | IssuePriority>('');
  const [filterLabelId, setFilterLabelId] = useState('');

  const layout: BoardLayout = project.boardLayout === 'list' ? 'list' : 'columns';
  const themeValue = isProjectTheme(project.theme) ? project.theme : DEFAULT_THEME;

  // Columns with a stored color keep it in every theme; null means "follow
  // the theme" and resolves to the current scheme's palette by position.
  const resolvedColumns = useMemo(
    () =>
      columns.map((c, i) => ({
        ...c,
        color: c.color ?? themeColumnColor(themeValue, i),
      })),
    [columns, themeValue],
  );
  const columnAccent = (columnId: string) =>
    resolvedColumns.find((c) => c.id === columnId)?.color ??
    themeColumnColor(themeValue, 0);
  const listFields = useMemo(
    () => normalizeListFields(project.listFields),
    [project.listFields],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const loadBoard = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setLoading(true);
      try {
        const board = await api.getBoard(project.id);
        setColumns(board.columns);
        setCustomColumns(board.customColumns ?? []);
      } catch (err) {
        if (!options?.silent) {
          toast.push(err instanceof ApiError ? err.message : 'Failed to load board', 'error');
        }
      } finally {
        if (!options?.silent) setLoading(false);
      }
    },
    [project.id, toast],
  );

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    api.listUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  // Escape clears the row selection (list view).
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedIds(new Set());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds.size]);

  // Adopt server-side widths when switching projects (or after a save).
  useEffect(() => {
    setWidths(project.listWidths ?? {});
  }, [project.id]);

  // Live updates: refresh (debounced, silently) whenever the server reports a
  // board change — e.g. another tab or an MCP agent mutating this project.
  useEffect(() => {
    const source = new EventSource(`/api/projects/${project.id}/events`);
    let timer: number | undefined;
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as { type?: string };
        if (data.type !== 'board_changed') return;
      } catch {
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void loadBoard({ silent: true });
        void reloadMeta();
      }, 300);
    };
    return () => {
      window.clearTimeout(timer);
      source.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reloadMeta identity is unstable
  }, [project.id, loadBoard]);

  const loadArchived = useCallback(async () => {
    setArchivedLoading(true);
    try {
      const res = await api.listIssues(project.id, { archived: 'true', limit: 200 });
      setArchived(res.items);
    } catch (err) {
      toast.push(
        err instanceof ApiError ? err.message : 'Failed to load archived issues',
        'error',
      );
    } finally {
      setArchivedLoading(false);
    }
  }, [project.id, toast]);

  useEffect(() => {
    if (showArchived) void loadArchived();
  }, [showArchived, loadArchived]);

  const refreshAfterIssueChange = () => {
    // Silent: keep the table mounted so expand state / open menus survive.
    void loadBoard({ silent: true });
    void reloadMeta();
    if (showArchived) void loadArchived();
  };

  const onRestoreArchived = async (issue: IssueListItem) => {
    try {
      await api.updateIssue(issue.id, { archived: false });
      toast.push(`${issue.key} restored`, 'success');
      await Promise.all([loadBoard(), loadArchived()]);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Restore failed', 'error');
    }
  };

  const onDeleteArchived = async (issue: IssueListItem) => {
    if (!confirm(`Permanently delete ${issue.key}? This cannot be undone.`)) return;
    try {
      await api.deleteIssue(issue.id);
      toast.push(`${issue.key} deleted`, 'success');
      void reloadMeta();
      await loadArchived();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Delete failed', 'error');
    }
  };

  const issueMap = useMemo(() => {
    const map = new Map<string, BoardIssue>();
    for (const col of columns) {
      for (const issue of col.issues) map.set(issue.id, issue);
    }
    return map;
  }, [columns]);

  const filtersActive =
    filterText.trim() !== '' ||
    filterType !== '' ||
    filterPriority !== '' ||
    filterLabelId !== '';

  const clearFilters = () => {
    setFilterText('');
    setFilterType('');
    setFilterPriority('');
    setFilterLabelId('');
  };

  // View-only filtering; DnD math keeps using the unfiltered `columns` state.
  const visibleColumns = useMemo(() => {
    if (!filtersActive) return columns;
    const text = filterText.trim().toLowerCase();
    return columns.map((c) => ({
      ...c,
      issues: c.issues.filter((i) => {
        if (text && !`${i.key} ${i.title}`.toLowerCase().includes(text)) {
          return false;
        }
        if (filterType && i.type !== filterType) return false;
        if (filterPriority && i.priority !== filterPriority) return false;
        if (filterLabelId && !i.labels.some((l) => l.labelId === filterLabelId)) {
          return false;
        }
        return true;
      }),
    }));
  }, [columns, filtersActive, filterText, filterType, filterPriority, filterLabelId]);

  const findColumnId = (id: string) => {
    if (columns.some((c) => c.id === id)) return id;
    if (id.startsWith('drop-')) {
      const raw = id.slice('drop-'.length);
      if (columns.some((c) => c.id === raw)) return raw;
    }
    return columns.find((c) => c.issues.some((i) => i.id === id))?.id;
  };

  const openIssue = (id: string, options?: OpenIssueOptions) => {
    const next = new URLSearchParams(searchParams);
    next.set('issue', id);
    if (options?.tab) next.set('tab', options.tab);
    else next.delete('tab');
    setSearchParams(next, { replace: false });
  };

  const closeIssue = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('issue');
    next.delete('tab');
    setSearchParams(next, { replace: true });
  };

  const patchProject = async (body: {
    theme?: ProjectTheme;
    boardLayout?: BoardLayout;
    listFields?: string[];
    listWidths?: Record<string, number>;
  }) => {
    setSavingPrefs(true);
    try {
      const updated = await api.updateProject(project.id, body);
      setProject(updated);
      if (body.theme) applyDocumentTheme(body.theme);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Update failed', 'error');
    } finally {
      setSavingPrefs(false);
    }
  };

  const onRenameColumn = async (columnId: string, name: string) => {
    try {
      await api.updateColumn(columnId, { name });
      setColumns((prev) =>
        prev.map((c) => (c.id === columnId ? { ...c, name } : c)),
      );
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Rename failed', 'error');
      await loadBoard();
    }
  };

  const onToggleDone = async (columnId: string, isDone: boolean) => {
    try {
      await api.updateColumn(columnId, { isDone });
      setColumns((prev) =>
        prev.map((c) => ({
          ...c,
          isDone: c.id === columnId ? isDone : isDone ? false : c.isDone,
        })),
      );
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Update failed', 'error');
      await loadBoard();
    }
  };

  const onColorChange = async (columnId: string, color: string | null) => {
    const prev = columns;
    setColumns((cols) =>
      cols.map((c) => (c.id === columnId ? { ...c, color } : c)),
    );
    try {
      await api.updateColumn(columnId, { color });
    } catch (err) {
      setColumns(prev);
      toast.push(err instanceof ApiError ? err.message : 'Color update failed', 'error');
    }
  };

  const onDeleteColumn = async (columnId: string) => {
    if (!confirm('Delete this empty column?')) return;
    try {
      await api.deleteColumn(columnId);
      setColumns((prev) => prev.filter((c) => c.id !== columnId));
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Delete failed', 'error');
      await loadBoard();
    }
  };

  const persistColumnOrder = async (nextIds: string[], prevColumns: BoardColumnWithIssues[]) => {
    setColumns((cols) => {
      const ordered = nextIds
        .map((id) => cols.find((c) => c.id === id))
        .filter((c): c is BoardColumnWithIssues => Boolean(c));
      return ordered;
    });
    try {
      await api.reorderColumns(project.id, nextIds);
    } catch (err) {
      setColumns(prevColumns);
      toast.push(err instanceof ApiError ? err.message : 'Reorder failed', 'error');
    }
  };

  const onAddColumn = async (e: FormEvent) => {
    e.preventDefault();
    const name = newColumnName.trim();
    if (!name) return;
    try {
      await api.createColumn(project.id, { name });
      setNewColumnName('');
      setAddingColumn(false);
      await loadBoard();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Create column failed', 'error');
    }
  };

  const onPatchIssue = async (
    issueId: string,
    patch: {
      priority?: IssuePriority;
      humanEffort?: number | null;
      locEffort?: number | null;
      dueDate?: string | null;
      description?: string | null;
    },
  ) => {
    const prev = columns;
    setColumns((cols) =>
      mapBoardIssues(cols, (i) => (i.id === issueId ? { ...i, ...patch } : i)),
    );
    try {
      await api.updateIssue(issueId, patch);
    } catch (err) {
      setColumns(prev);
      toast.push(err instanceof ApiError ? err.message : 'Update failed', 'error');
    }
  };

  const onMoveToColumn = async (issueId: string, columnId: string) => {
    const prev = columns;
    const isTopLevel = issueMap.has(issueId);
    if (isTopLevel) {
      setColumns((cols) => {
        const next = cols.map((c) => ({ ...c, issues: [...c.issues] }));
        const source = next.find((c) => c.issues.some((i) => i.id === issueId));
        const dest = next.find((c) => c.id === columnId);
        if (!source || !dest || source.id === dest.id) return cols;
        const idx = source.issues.findIndex((i) => i.id === issueId);
        const [moved] = source.issues.splice(idx, 1);
        moved.columnId = columnId;
        dest.issues.push(moved);
        return next;
      });
    } else {
      // Subtask: it stays nested under its parent, only its status changes.
      setColumns((cols) =>
        mapBoardIssues(cols, (i) => (i.id === issueId ? { ...i, columnId } : i)),
      );
    }
    try {
      const result = await api.moveIssue(issueId, { columnId });
      for (const w of result.warnings) toast.push(w.message, 'warning');
      await loadBoard({ silent: true });
    } catch (err) {
      setColumns(prev);
      toast.push(err instanceof ApiError ? err.message : 'Move failed', 'error');
    }
  };

  const onSetEpic = async (issueId: string, epicId: string | null) => {
    const prev = columns;
    const epic = epicId ? epics.find((e) => e.id === epicId) ?? null : null;
    setColumns((cols) =>
      cols.map((c) => ({
        ...c,
        issues: c.issues.map((i) =>
          i.id === issueId
            ? {
                ...i,
                epicId,
                epic: epic ? { id: epic.id, name: epic.name, color: epic.color } : null,
              }
            : i,
        ),
      })),
    );
    try {
      await api.updateIssue(issueId, { epicId });
    } catch (err) {
      setColumns(prev);
      toast.push(err instanceof ApiError ? err.message : 'Epic update failed', 'error');
    }
  };

  const labelActions: LabelActions = {
    toggle: async (issueId, label, attach) => {
      const prev = columns;
      setColumns((cols) =>
        mapBoardIssues(cols, (i) => {
          if (i.id !== issueId) return i;
          const nextLabels = attach
            ? [...i.labels, { issueId, labelId: label.id, label }]
            : i.labels.filter((l) => l.labelId !== label.id);
          return { ...i, labels: nextLabels };
        }),
      );
      try {
        if (attach) await api.attachLabel(issueId, label.id);
        else await api.detachLabel(issueId, label.id);
      } catch (err) {
        setColumns(prev);
        toast.push(err instanceof ApiError ? err.message : 'Label update failed', 'error');
      }
    },
    create: async (name, color) => {
      try {
        const label = await api.createLabel(project.id, { name, color });
        await reloadMeta();
        return label;
      } catch (err) {
        toast.push(err instanceof ApiError ? err.message : 'Create label failed', 'error');
        return null;
      }
    },
    update: async (labelId, patch) => {
      try {
        await api.updateLabel(labelId, patch);
        await Promise.all([reloadMeta(), loadBoard({ silent: true })]);
      } catch (err) {
        toast.push(err instanceof ApiError ? err.message : 'Label update failed', 'error');
      }
    },
    remove: async (label) => {
      if (!confirm(`Delete label "${label.name}"? It will be removed from all issues.`)) {
        return;
      }
      try {
        await api.deleteLabel(label.id);
        await Promise.all([reloadMeta(), loadBoard({ silent: true })]);
      } catch (err) {
        toast.push(err instanceof ApiError ? err.message : 'Delete label failed', 'error');
      }
    },
  };

  const onAddCustomColumn = async (type: CustomColumnType) => {
    const base = COLUMN_TYPE_OPTIONS.find((o) => o.type === type)?.label ?? 'Column';
    const name = nextLabelName(customColumns, base);
    try {
      const created = await api.createCustomColumn(project.id, {
        name,
        type,
        ...(type === 'label' ? { settings: { options: [] } } : {}),
      });
      setCustomColumns((prev) => [...prev, created]);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Create column failed', 'error');
    }
  };

  const onRenameCustomColumn = async (columnId: string, name: string) => {
    const prev = customColumns;
    setCustomColumns((cols) =>
      cols.map((c) => (c.id === columnId ? { ...c, name } : c)),
    );
    try {
      await api.updateCustomColumn(columnId, { name });
    } catch (err) {
      setCustomColumns(prev);
      toast.push(err instanceof ApiError ? err.message : 'Rename failed', 'error');
    }
  };

  const onDeleteCustomColumn = async (column: CustomColumn) => {
    if (!confirm(`Delete column "${column.name}" and all its values?`)) return;
    try {
      await api.deleteCustomColumn(column.id);
      setCustomColumns((prev) => prev.filter((c) => c.id !== column.id));
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Delete column failed', 'error');
    }
  };

  const onUpdateCustomSettings = async (
    columnId: string,
    settings: CustomColumn['settings'],
  ) => {
    const prev = customColumns;
    setCustomColumns((cols) =>
      cols.map((c) => (c.id === columnId ? { ...c, settings } : c)),
    );
    try {
      await api.updateCustomColumn(columnId, { settings });
    } catch (err) {
      setCustomColumns(prev);
      toast.push(err instanceof ApiError ? err.message : 'Column update failed', 'error');
    }
  };

  const onSetCustomValue = async (
    issueId: string,
    columnId: string,
    value: CustomValuePayload | null,
  ) => {
    const prev = columns;
    setColumns((cols) =>
      mapBoardIssues(cols, (i) => {
        if (i.id !== issueId) return i;
        const existing = i.customValues ?? [];
        const next =
          value === null
            ? existing.filter((v) => v.columnId !== columnId)
            : existing.some((v) => v.columnId === columnId)
              ? existing.map((v) =>
                  v.columnId === columnId ? { ...v, value } : v,
                )
              : [...existing, { issueId, columnId, value }];
        return { ...i, customValues: next };
      }),
    );
    try {
      await api.setCustomValue(issueId, columnId, value);
    } catch (err) {
      setColumns(prev);
      toast.push(err instanceof ApiError ? err.message : 'Update failed', 'error');
    }
  };

  const onHideField = (id: ListFieldId) => {
    if (id === 'title') return;
    void patchProject({ listFields: listFields.filter((f) => f !== id) });
  };

  const onCommitWidth = (id: string, w: number) => {
    const next = { ...widths, [id]: w };
    setWidths(next);
    void patchProject({ listWidths: next });
  };

  const onToggleSelect = (issueId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(issueId);
      else next.delete(issueId);
      return next;
    });
  };

  const onToggleSelectMany = (issueIds: string[], selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of issueIds) {
        if (selected) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  /** Selected issue ids in board order (top to bottom across sections). */
  const selectedInBoardOrder = () =>
    columns.flatMap((c) =>
      c.issues.filter((i) => selectedIds.has(i.id)).map((i) => i.id),
    );

  const onMoveIssuesToColumn = async (issueIds: string[], columnId: string) => {
    if (!columns.some((c) => c.id === columnId)) return;
    const toMove = issueIds.filter(
      (id) => issueMap.get(id) && issueMap.get(id)?.columnId !== columnId,
    );
    if (toMove.length === 0) return;
    const prev = columns;
    const moveSet = new Set(toMove);
    setColumns((cols) => {
      const next = cols.map((c) => ({ ...c, issues: [...c.issues] }));
      const moved: BoardIssue[] = [];
      for (const c of next) {
        c.issues = c.issues.filter((i) => {
          if (moveSet.has(i.id)) {
            moved.push({ ...i, columnId });
            return false;
          }
          return true;
        });
      }
      const target = next.find((c) => c.id === columnId);
      if (!target) return cols;
      target.issues.push(...moved);
      return next;
    });
    try {
      // Sequential moves preserve the relative order (each appends at the end
      // of the target column). Warnings are deduplicated across issues.
      const warnings = new Set<string>();
      for (const id of toMove) {
        const result = await api.moveIssue(id, { columnId });
        for (const w of result.warnings) warnings.add(w.message);
      }
      for (const message of warnings) toast.push(message, 'warning');
      setSelectedIds(new Set());
      await loadBoard({ silent: true });
    } catch (err) {
      setColumns(prev);
      toast.push(err instanceof ApiError ? err.message : 'Move failed', 'error');
      await loadBoard({ silent: true });
    }
  };

  const listExtras: ListTableExtras = {
    customColumns,
    users,
    customHandlers: {
      setValue: onSetCustomValue,
      updateSettings: onUpdateCustomSettings,
    },
    widths,
    onLiveWidth: (id, w) => setWidths((prev) => ({ ...prev, [id]: w })),
    onCommitWidth,
    onAddColumn: (type) => void onAddCustomColumn(type),
    onRenameCustomColumn,
    onDeleteCustomColumn,
    onHideField,
    selectedIds,
    onToggleSelect,
    onToggleSelectMany,
    onAddSubtask: async (parentId, title) => {
      try {
        await api.createSubtask(parentId, { title });
        await loadBoard({ silent: true });
      } catch (err) {
        toast.push(err instanceof ApiError ? err.message : 'Create subtask failed', 'error');
      }
    },
  };

  const onDragStart = (event: DragStartEvent) => {
    const type = event.active.data.current?.type;
    if (type === 'column') {
      setDraggingColumn(true);
      setActiveIssue(null);
      setDraggingRowIds(null);
      return;
    }
    if (type === 'list-row') {
      const issueId = String(event.active.data.current?.issueId ?? '');
      const partOfSelection = selectedIds.has(issueId);
      const ids = partOfSelection ? selectedInBoardOrder() : [issueId];
      if (!partOfSelection) setSelectedIds(new Set([issueId]));
      setDraggingRowIds(ids);
      setDraggingColumn(false);
      setActiveIssue(null);
      return;
    }
    setDraggingColumn(false);
    setDraggingRowIds(null);
    const issue = issueMap.get(String(event.active.id));
    setActiveIssue(issue ?? null);
  };

  const onDragOver = (event: DragOverEvent) => {
    if (draggingColumn || event.active.data.current?.type === 'column') return;
    // List rows don't re-shuffle live; the section highlight is the feedback.
    if (event.active.data.current?.type === 'list-row') return;
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const fromCol = findColumnId(activeId);
    const toCol = findColumnId(overId);
    if (!fromCol || !toCol || fromCol === toCol) return;

    setColumns((prev) => {
      const next = prev.map((c) => ({ ...c, issues: [...c.issues] }));
      const source = next.find((c) => c.id === fromCol);
      const dest = next.find((c) => c.id === toCol);
      if (!source || !dest) return prev;
      const idx = source.issues.findIndex((i) => i.id === activeId);
      if (idx < 0) return prev;
      const [moved] = source.issues.splice(idx, 1);
      moved.columnId = toCol;

      const overIndex = dest.issues.findIndex((i) => i.id === overId);
      if (overIndex >= 0) dest.issues.splice(overIndex, 0, moved);
      else dest.issues.push(moved);
      return next;
    });
  };

  const onDragEnd = async (event: DragEndEvent) => {
    if (event.active.data.current?.type === 'list-row') {
      const ids = draggingRowIds ?? [];
      setDraggingRowIds(null);
      if (!event.over) return;
      const columnId = findColumnId(String(event.over.id));
      if (!columnId || ids.length === 0) return;
      await onMoveIssuesToColumn(ids, columnId);
      return;
    }

    const wasColumn = draggingColumn || event.active.data.current?.type === 'column';
    setActiveIssue(null);
    setDraggingColumn(false);

    const { active, over } = event;
    if (!over) {
      if (!wasColumn) void loadBoard();
      return;
    }

    if (wasColumn) {
      const activeId = String(active.id);
      const overId = findColumnId(String(over.id)) ?? String(over.id);
      const oldIndex = columns.findIndex((c) => c.id === activeId);
      const newIndex = columns.findIndex((c) => c.id === overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const prevColumns = columns;
      const nextIds = arrayMove(
        columns.map((c) => c.id),
        oldIndex,
        newIndex,
      );
      await persistColumnOrder(nextIds, prevColumns);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    const columnId = findColumnId(overId) ?? findColumnId(activeId);
    if (!columnId) {
      void loadBoard();
      return;
    }

    const nextColumns = columns.map((c) => ({ ...c, issues: [...c.issues] }));
    const fromColId = nextColumns.find((c) => c.issues.some((i) => i.id === activeId))?.id;
    const dest = nextColumns.find((c) => c.id === columnId);
    if (!dest) {
      void loadBoard();
      return;
    }

    if (fromColId && fromColId === columnId && overId !== activeId) {
      const from = dest.issues.findIndex((i) => i.id === activeId);
      const to =
        overId === columnId || overId === `drop-${columnId}`
          ? dest.issues.length - 1
          : dest.issues.findIndex((i) => i.id === overId);
      if (from >= 0 && to >= 0 && from !== to) {
        const [moved] = dest.issues.splice(from, 1);
        dest.issues.splice(to, 0, moved);
      }
    } else if (fromColId && fromColId !== columnId) {
      if (!dest.issues.some((i) => i.id === activeId)) {
        const source = nextColumns.find((c) => c.id === fromColId);
        const idx = source?.issues.findIndex((i) => i.id === activeId) ?? -1;
        if (source && idx >= 0) {
          const [moved] = source.issues.splice(idx, 1);
          moved.columnId = columnId;
          dest.issues.push(moved);
        }
      }
    }

    setColumns(nextColumns);

    const ids = dest.issues.map((i) => i.id);
    const activeIndex = ids.indexOf(activeId);
    const beforeIssueId =
      activeIndex >= 0 && activeIndex < ids.length - 1 ? ids[activeIndex + 1] : undefined;
    const afterIssueId =
      activeIndex > 0 && beforeIssueId === undefined ? ids[activeIndex - 1] : undefined;

    try {
      const result = await api.moveIssue(activeId, {
        columnId,
        beforeIssueId,
        afterIssueId,
      });
      for (const w of result.warnings) {
        toast.push(w.message, 'warning');
      }
      await loadBoard();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Move failed', 'error');
      await loadBoard();
    }
  };

  const openDraft = () => {
    closeIssue();
    setDraftOpen(true);
  };

  const closeDraft = () => setDraftOpen(false);

  return (
    <main className="page board-page">
      <div className="page-header compact board-toolbar">
        <div className="board-filters">
          <label>
            <span>Theme</span>
            <select
              value={themeValue}
              disabled={savingPrefs}
              onChange={(e) =>
                void patchProject({ theme: e.target.value as ProjectTheme })
              }
            >
              {PROJECT_THEMES.map((id) => (
                <option key={id} value={id}>
                  {THEME_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
          <div className="seg-toggle" role="group" aria-label="Board layout">
            <button
              type="button"
              className={layout === 'columns' ? 'active' : undefined}
              disabled={savingPrefs || layout === 'columns'}
              onClick={() => void patchProject({ boardLayout: 'columns' })}
            >
              Columns
            </button>
            <button
              type="button"
              className={layout === 'list' ? 'active' : undefined}
              disabled={savingPrefs || layout === 'list'}
              onClick={() => void patchProject({ boardLayout: 'list' })}
            >
              List
            </button>
          </div>
          {layout === 'list' ? (
            <ListFieldsMenu
              fields={listFields}
              saving={savingPrefs}
              onChange={(next) => void patchProject({ listFields: next })}
            />
          ) : null}
          <div className="board-issue-filters">
            <input
              className="board-filter-input"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter issues…"
              aria-label="Filter issues by text"
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as '' | IssueType)}
              aria-label="Filter by type"
            >
              <option value="">All types</option>
              <option value="task">Task</option>
              <option value="bug">Bug</option>
              <option value="story">Story</option>
            </select>
            <select
              value={filterPriority}
              onChange={(e) =>
                setFilterPriority(e.target.value as '' | IssuePriority)
              }
              aria-label="Filter by priority"
            >
              <option value="">All priorities</option>
              {PRIORITY_ORDER.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {labels.length > 0 ? (
              <select
                value={filterLabelId}
                onChange={(e) => setFilterLabelId(e.target.value)}
                aria-label="Filter by label"
              >
                <option value="">All labels</option>
                {labels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            ) : null}
            {filtersActive ? (
              <button type="button" className="btn btn-ghost" onClick={clearFilters}>
                Clear
              </button>
            ) : null}
          </div>
        </div>
        <div className="board-toolbar-actions">
          <button
            type="button"
            className={`btn btn-ghost${showArchived ? ' active' : ''}`}
            aria-pressed={showArchived}
            onClick={() => setShowArchived((v) => !v)}
          >
            Archived
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setAddingColumn((v) => !v)}
          >
            {addingColumn ? 'Cancel' : 'Add column'}
          </button>
          <button type="button" className="btn btn-primary" onClick={openDraft}>
            New issue
          </button>
        </div>
      </div>

      {addingColumn ? (
        <form className="panel inline-create" onSubmit={(e) => void onAddColumn(e)}>
          <input
            autoFocus
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            placeholder="Column name"
            required
            maxLength={80}
          />
          <button type="submit" className="btn btn-primary">
            Add column
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setAddingColumn(false);
              setNewColumnName('');
            }}
          >
            Cancel
          </button>
        </form>
      ) : null}

      {showArchived ? (
        <section className="panel archived-panel">
          <header className="archived-panel-header">
            <h2>Archived issues</h2>
            <span className="count-pill">{archived.length}</span>
          </header>
          {archivedLoading ? (
            <Loading label="Loading archived…" />
          ) : archived.length === 0 ? (
            <p className="muted">No archived issues.</p>
          ) : (
            <ul className="archived-list">
              {archived.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    className="monday-title-btn archived-title"
                    onClick={() => openIssue(i.id)}
                  >
                    <span className="issue-key">{i.key}</span>
                    <span>{i.title}</span>
                  </button>
                  <span className="muted">
                    {i.archivedAt ? `archived ${formatRelative(i.archivedAt)}` : ''}
                  </span>
                  <div className="archived-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void onRestoreArchived(i)}
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost danger"
                      onClick={() => void onDeleteArchived(i)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {loading ? (
        <Loading label="Loading board…" />
      ) : columns.length === 0 ? (
        <EmptyState title="No columns" body="This project has no board columns." />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={(e) => void onDragEnd(e)}
        >
          <SortableContext
            items={columns.map((c) => c.id)}
            strategy={
              layout === 'list' ? verticalListSortingStrategy : horizontalListSortingStrategy
            }
          >
            <div className={layout === 'list' ? 'board-list' : 'board-columns'}>
              {visibleColumns.map((col) => (
                <ColumnDrop
                  key={col.id}
                  column={col}
                  accent={columnAccent(col.id)}
                  layout={layout}
                  listFields={listFields}
                  labels={labels}
                  labelActions={labelActions}
                  epics={epics}
                  allColumns={resolvedColumns}
                  extras={listExtras}
                  onMoveColumn={onMoveToColumn}
                  onSetEpic={onSetEpic}
                  collapsed={Boolean(collapsed[col.id])}
                  onToggleCollapse={() =>
                    setCollapsed((prev) => ({ ...prev, [col.id]: !prev[col.id] }))
                  }
                  onOpen={openIssue}
                  onRename={onRenameColumn}
                  onToggleDone={onToggleDone}
                  onDelete={onDeleteColumn}
                  onColorChange={onColorChange}
                  onPatchIssue={onPatchIssue}
                  canDelete={columns.length > 1}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeIssue ? (
              <IssueCardOverlay issue={activeIssue} />
            ) : draggingRowIds && draggingRowIds.length > 0 ? (
              <div className="row-drag-chip">
                {draggingRowIds.length === 1 ? (
                  <>
                    <span className="issue-key">
                      {issueMap.get(draggingRowIds[0])?.key}
                    </span>{' '}
                    {issueMap.get(draggingRowIds[0])?.title}
                  </>
                ) : (
                  `${draggingRowIds.length} issues`
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {layout === 'list' && selectedIds.size > 0 ? (
        <div className="selection-bar" role="toolbar" aria-label="Selection actions">
          <span className="selection-bar-count">
            {selectedIds.size} selected
          </span>
          <label className="selection-bar-move">
            <span>Move to</span>
            <select
              value=""
              aria-label="Move selected issues to column"
              onChange={(e) => {
                const id = e.target.value;
                if (id) void onMoveIssuesToColumn(selectedInBoardOrder(), id);
              }}
            >
              <option value="" disabled>
                Column…
              </option>
              {resolvedColumns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </button>
        </div>
      ) : null}

      {draftOpen ? (
        <IssueDrawer
          mode="create"
          projectId={project.id}
          labels={labels}
          epics={epics}
          columns={columns}
          defaultColumnId={columns[0]?.id}
          onClose={closeDraft}
          onChanged={refreshAfterIssueChange}
          onCreated={(id) => {
            closeDraft();
            openIssue(id);
          }}
        />
      ) : issueId ? (
        <IssueDrawer
          issueId={issueId}
          projectId={project.id}
          labels={labels}
          epics={epics}
          columns={columns}
          initialTab={drawerTab}
          onClose={closeIssue}
          onChanged={refreshAfterIssueChange}
          onOpenIssue={openIssue}
        />
      ) : null}
    </main>
  );
}
