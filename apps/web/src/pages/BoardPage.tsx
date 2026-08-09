import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
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
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type {
  BoardColumnWithIssues,
  BoardIssue,
  BoardLayout,
  IssueListItem,
  IssuePriority,
  IssueType,
  ListFieldId,
  ProjectTheme,
} from '../api/types';
import { ApiError, DEFAULT_LIST_FIELDS } from '../api/types';
import { ColorPicker } from '../components/ColorPicker';
import { EpicBadge } from '../components/EpicBadge';
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
} from '../theme/themes';
import type { ProjectContext } from './ProjectLayout';

const LIST_FIELD_OPTIONS: { id: ListFieldId; label: string }[] = [
  { id: 'key', label: 'Key' },
  { id: 'title', label: 'Title' },
  { id: 'priority', label: 'Priority' },
  { id: 'humanEffort', label: 'Human (h)' },
  { id: 'locEffort', label: 'LOC' },
  { id: 'dueDate', label: 'Due' },
  { id: 'type', label: 'Type' },
  { id: 'labels', label: 'Labels' },
  { id: 'blockers', label: 'Blockers' },
];

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

function ListIssueTable({
  column,
  fields,
  onOpen,
  onPatchIssue,
}: {
  column: BoardColumnWithIssues;
  fields: ListFieldId[];
  onOpen: (id: string, options?: OpenIssueOptions) => void;
  onPatchIssue: (
    issueId: string,
    patch: {
      priority?: IssuePriority;
      humanEffort?: number | null;
      locEffort?: number | null;
      dueDate?: string | null;
    },
  ) => Promise<void>;
}) {
  const show = (id: ListFieldId) => fields.includes(id);
  const [sortKey, setSortKey] = useState<ListSortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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

  const sortHeader = (key: ListSortKey, label: string) => (
    <th>
      <button
        type="button"
        className="monday-th-btn"
        onClick={() => toggleSort(key)}
        aria-label={`Sort by ${label}`}
      >
        {label}
        {sortKey === key ? (
          <span className="monday-sort-indicator" aria-hidden>
            {sortDir === 'asc' ? '▲' : '▼'}
          </span>
        ) : null}
      </button>
    </th>
  );

  return (
    <div className="monday-table-wrap">
      <table className="monday-table">
        <thead>
          <tr>
            {show('key') ? sortHeader('key', 'Key') : null}
            {show('title') ? sortHeader('title', 'Title') : null}
            {show('priority') ? sortHeader('priority', 'Priority') : null}
            {show('humanEffort') ? sortHeader('humanEffort', 'Human (h)') : null}
            {show('locEffort') ? sortHeader('locEffort', 'LOC') : null}
            {show('dueDate') ? sortHeader('dueDate', 'Due') : null}
            {show('type') ? sortHeader('type', 'Type') : null}
            {show('labels') ? <th>Labels</th> : null}
            {show('blockers') ? <th>Blockers</th> : null}
          </tr>
        </thead>
        <tbody>
          {sortedIssues.length === 0 ? (
            <tr>
              <td colSpan={Math.max(fields.length, 1)} className="muted">
                No issues
              </td>
            </tr>
          ) : (
            sortedIssues.map((issue) => {
              const blocked = issue._count?.linksTo ?? 0;
              return (
                <tr key={issue.id}>
                  {show('key') ? (
                    <td>
                      <span className="issue-key">{issue.key}</span>
                    </td>
                  ) : null}
                  {show('title') ? (
                    <td>
                      <div className="monday-title-cell">
                        <button
                          type="button"
                          className="monday-title-btn"
                          onClick={() => onOpen(issue.id)}
                        >
                          {issue.title}
                        </button>
                        {issue.epic ? <EpicBadge epic={issue.epic} /> : null}
                      </div>
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
                          !column.isDone && isOverdue(issue.dueDate) ? ' overdue' : ''
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
                    <td>
                      <div className="monday-labels">
                        {issue.labels.map((l) => (
                          <span
                            key={l.labelId}
                            className="label-chip"
                            style={{ ['--label-color' as string]: l.label.color }}
                          >
                            {l.label.name}
                          </span>
                        ))}
                      </div>
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
                </tr>
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
  layout,
  collapsed,
  listFields,
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
  layout: BoardLayout;
  collapsed?: boolean;
  listFields: ListFieldId[];
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
    ...(column.color ? { ['--col-accent' as string]: column.color } : {}),
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
            value={column.color}
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
    void loadBoard();
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
    },
  ) => {
    const prev = columns;
    setColumns((cols) =>
      cols.map((c) => ({
        ...c,
        issues: c.issues.map((i) => (i.id === issueId ? { ...i, ...patch } : i)),
      })),
    );
    try {
      await api.updateIssue(issueId, patch);
    } catch (err) {
      setColumns(prev);
      toast.push(err instanceof ApiError ? err.message : 'Update failed', 'error');
    }
  };

  const onDragStart = (event: DragStartEvent) => {
    const type = event.active.data.current?.type;
    if (type === 'column') {
      setDraggingColumn(true);
      setActiveIssue(null);
      return;
    }
    setDraggingColumn(false);
    const issue = issueMap.get(String(event.active.id));
    setActiveIssue(issue ?? null);
  };

  const onDragOver = (event: DragOverEvent) => {
    if (draggingColumn || event.active.data.current?.type === 'column') return;
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
                  layout={layout}
                  listFields={listFields}
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
            {activeIssue ? <IssueCardOverlay issue={activeIssue} /> : null}
          </DragOverlay>
        </DndContext>
      )}

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
          initialTab={drawerTab}
          onClose={closeIssue}
          onChanged={refreshAfterIssueChange}
        />
      ) : null}
    </main>
  );
}
