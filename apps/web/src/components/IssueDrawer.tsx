import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type {
  ActivityEvent,
  Attachment,
  BoardColumn,
  Comment,
  Epic,
  IssueDetail,
  IssueListItem,
  IssuePriority,
  IssueType,
  Label,
} from '../api/types';
import { ApiError } from '../api/types';
import {
  activityLabel,
  formatRelative,
  PRIORITY_ORDER,
  toDateInputValue,
  typeLabel,
} from '../lib/format';
import { useToast } from './Toast';
import { nextLabelColor } from './LabelCell';
import { Loading } from './Loading';
import { MarkdownDocument } from './MarkdownDocument';
import { PriorityBadge } from './PriorityBadge';
import { TypeBadge } from './TypeBadge';

export type DrawerTab = 'details' | 'links' | 'files' | 'comments' | 'activity';

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function IssueSearchPicker({
  projectId,
  excludeIds,
  placeholder,
  disabled,
  onPick,
}: {
  projectId: string;
  excludeIds: string[];
  placeholder: string;
  disabled?: boolean;
  onPick: (issue: IssueListItem) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<IssueListItem[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const exclude = useMemo(() => new Set(excludeIds), [excludeIds]);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      void api
        .listIssues(projectId, { q: query, limit: 20 })
        .then((res) => {
          setResults(res.items.filter((i) => !exclude.has(i.id)));
        })
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [q, projectId, exclude]);

  return (
    <div className="issue-picker">
      <input
        value={q}
        disabled={disabled}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && q.trim() ? (
        <ul className="issue-picker-results" role="listbox">
          {searching ? <li className="muted">Searching…</li> : null}
          {!searching && results.length === 0 ? (
            <li className="muted">No matching issues</li>
          ) : null}
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="issue-picker-option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(item);
                  setQ('');
                  setResults([]);
                  setOpen(false);
                }}
              >
                <span className="issue-key">{item.key}</span>
                <span>{item.title}</span>
                {item.parentId ? <span className="muted">subtask</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type IssueDrawerBase = {
  projectId: string;
  labels: Label[];
  epics: Epic[];
  onClose: () => void;
  onChanged: () => void;
};

type EditDrawerProps = IssueDrawerBase & {
  mode?: 'edit';
  issueId: string;
  initialTab?: DrawerTab;
  columns?: BoardColumn[];
  defaultColumnId?: string;
  onCreated?: (issueId: string) => void;
};

type CreateDrawerProps = IssueDrawerBase & {
  mode: 'create';
  issueId?: undefined;
  initialTab?: undefined;
  columns: BoardColumn[];
  defaultColumnId?: string;
  onCreated: (issueId: string) => void;
};

export type IssueDrawerProps = EditDrawerProps | CreateDrawerProps;

export function IssueDrawer(props: IssueDrawerProps) {
  const { projectId, labels, epics, onClose, onChanged } = props;
  const isCreate = props.mode === 'create';
  const issueId = isCreate ? undefined : props.issueId;
  const initialTab = isCreate ? 'details' : (props.initialTab ?? 'details');
  const columns = props.columns ?? [];
  const toast = useToast();

  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [draftDocument, setDraftDocument] = useState('');
  const [draftType, setDraftType] = useState<IssueType>('task');
  const [draftPriority, setDraftPriority] = useState<IssuePriority>('medium');
  const [draftColumnId, setDraftColumnId] = useState(
    props.defaultColumnId ?? columns[0]?.id ?? '',
  );
  const [draftEpicId, setDraftEpicId] = useState('');
  const [draftHumanEffort, setDraftHumanEffort] = useState('');
  const [draftLocEffort, setDraftLocEffort] = useState('');
  const [draftDueDate, setDraftDueDate] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [tab, setTab] = useState<DrawerTab>(initialTab);

  useEffect(() => {
    if (isCreate) {
      setDraftColumnId(props.defaultColumnId ?? columns[0]?.id ?? '');
    }
  }, [isCreate, props.defaultColumnId, columns]);

  const load = async (id: string) => {
    setLoading(true);
    try {
      const [iss, cmts, act, files] = await Promise.all([
        api.getIssue(id),
        api.listComments(id),
        api.listIssueActivity(id),
        api.listAttachments(id),
      ]);
      setIssue(iss);
      setTitle(iss.title);
      setDescription(iss.description ?? '');
      setComments(cmts);
      setActivity(act.items);
      setAttachments(files);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed to load issue', 'error');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isCreate || !issueId) return;
    setTab(initialTab);
    void load(issueId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when issueId / initialTab changes
  }, [issueId, initialTab, isCreate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const saveFields = async (patch: Parameters<typeof api.updateIssue>[1]) => {
    if (!issue) return;
    setSaving(true);
    try {
      const updated = await api.updateIssue(issue.id, patch);
      setIssue(updated);
      setTitle(updated.title);
      setDescription(updated.description ?? '');
      onChanged();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onSaveTitle = async () => {
    if (!issue || title.trim() === issue.title) return;
    await saveFields({ title: title.trim() });
  };

  const onSaveDescription = async () => {
    if (!issue) return;
    const next = description.trim() || null;
    if (next === (issue.description ?? null)) return;
    await saveFields({ description: next });
  };

  const onCreate = async () => {
    if (!title.trim()) {
      toast.push('Title is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const humanRaw = draftHumanEffort.trim();
      const locRaw = draftLocEffort.trim();
      const humanEffort = humanRaw === '' ? undefined : Number(humanRaw);
      const locEffort = locRaw === '' ? undefined : Math.round(Number(locRaw));
      if (humanRaw !== '' && Number.isNaN(humanEffort)) {
        toast.push('Invalid human effort', 'error');
        return;
      }
      if (locRaw !== '' && Number.isNaN(locEffort)) {
        toast.push('Invalid LOC effort', 'error');
        return;
      }
      const created = await api.createIssue(projectId, {
        title: title.trim(),
        description: description.trim() || undefined,
        document: draftDocument.trim() || undefined,
        type: draftType,
        priority: draftPriority,
        columnId: draftColumnId || undefined,
        humanEffort: humanEffort ?? null,
        locEffort: locEffort ?? null,
        dueDate: draftDueDate || null,
        epicId: draftEpicId || null,
      });
      onChanged();
      if (props.onCreated) props.onCreated(created.id);
      else onClose();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Create failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onAddComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!issueId || !commentBody.trim()) return;
    try {
      const c = await api.addComment(issueId, commentBody.trim());
      setComments((prev) => [...prev, c]);
      setCommentBody('');
      const act = await api.listIssueActivity(issueId);
      setActivity(act.items);
      onChanged();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Comment failed', 'error');
    }
  };

  const onAddSubtask = async (e: FormEvent) => {
    e.preventDefault();
    if (!issueId || !subtaskTitle.trim()) return;
    try {
      await api.createSubtask(issueId, { title: subtaskTitle.trim() });
      setSubtaskTitle('');
      await load(issueId);
      onChanged();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Subtask failed', 'error');
    }
  };

  const onAddBlockedBy = async (blocker: IssueListItem) => {
    if (!issue) return;
    try {
      await api.createLink(blocker.id, issue.id, 'blocks');
      await load(issue.id);
      onChanged();
      toast.push(`Blocked by ${blocker.key}`, 'success');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Link failed', 'error');
    }
  };

  const onAddBlocks = async (target: IssueListItem) => {
    if (!issue) return;
    try {
      await api.createLink(issue.id, target.id, 'blocks');
      await load(issue.id);
      onChanged();
      toast.push(`Now blocks ${target.key}`, 'success');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Link failed', 'error');
    }
  };

  const onAddRelated = async (target: IssueListItem) => {
    if (!issue) return;
    try {
      await api.createLink(issue.id, target.id, 'relates_to');
      await load(issue.id);
      onChanged();
      toast.push(`Related to ${target.key}`, 'success');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Link failed', 'error');
    }
  };

  const onAddDuplicate = async (target: IssueListItem) => {
    if (!issue) return;
    try {
      await api.createLink(issue.id, target.id, 'duplicates');
      await load(issue.id);
      onChanged();
      toast.push(`Marked as duplicate of ${target.key}`, 'success');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Link failed', 'error');
    }
  };

  const removeLink = async (linkId: string) => {
    if (!issue) return;
    try {
      await api.deleteLink(linkId);
      await load(issue.id);
      onChanged();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Remove failed', 'error');
    }
  };

  const onUploadFile = async (file: File | null | undefined) => {
    if (!issue || !file) return;
    setUploading(true);
    try {
      const created = await api.uploadAttachment(issue.id, file);
      setAttachments((prev) => [...prev, created]);
      onChanged();
      toast.push(`Uploaded ${created.filename}`, 'success');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const onDeleteAttachment = async (attachment: Attachment) => {
    if (!issue) return;
    if (!confirm(`Delete ${attachment.filename}?`)) return;
    try {
      await api.deleteAttachment(attachment.id);
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
      onChanged();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Delete failed', 'error');
    }
  };

  const onToggleArchive = async () => {
    if (!issue) return;
    const archiving = !issue.archivedAt;
    await saveFields({ archived: archiving });
    toast.push(
      archiving ? `${issue.key} archived` : `${issue.key} restored`,
      'success',
    );
  };

  const onDelete = async () => {
    if (!issue) return;
    const subs = issue.subtasks.length;
    const detail = subs > 0 ? ` and its ${subs} subtask${subs > 1 ? 's' : ''}` : '';
    if (!confirm(`Permanently delete ${issue.key}${detail}? This cannot be undone.`)) {
      return;
    }
    setSaving(true);
    try {
      await api.deleteIssue(issue.id);
      toast.push(`${issue.key} deleted`, 'success');
      onChanged();
      onClose();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Delete failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleLabel = async (labelId: string) => {
    if (!issue) return;
    const attached = issue.labels.some((l) => l.labelId === labelId);
    try {
      if (attached) await api.detachLabel(issue.id, labelId);
      else await api.attachLabel(issue.id, labelId);
      await load(issue.id);
      onChanged();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Label update failed', 'error');
    }
  };

  const attachedIds = new Set(issue?.labels.map((l) => l.labelId) ?? []);
  const blockedBy = issue?.blockers?.blockedBy ?? [];
  const blocks = issue?.blockers?.blocks ?? [];
  const linksFrom = issue?.linksFrom ?? [];
  const linksTo = issue?.linksTo ?? [];
  const blockedByLinkByIssueId = new Map(
    linksTo
      .filter((l) => l.type === 'blocks')
      .map((l) => [l.sourceId, l.id] as const),
  );
  const blocksLinkByIssueId = new Map(
    linksFrom
      .filter((l) => l.type === 'blocks')
      .map((l) => [l.targetId, l.id] as const),
  );
  // relates_to is symmetric: merge both directions into "other party" entries
  const related = [
    ...linksFrom
      .filter((l) => l.type === 'relates_to')
      .map((l) => ({ linkId: l.id, party: l.target })),
    ...linksTo
      .filter((l) => l.type === 'relates_to')
      .map((l) => ({ linkId: l.id, party: l.source })),
  ];
  const duplicates = [
    ...linksFrom
      .filter((l) => l.type === 'duplicates')
      .map((l) => ({ linkId: l.id, party: l.target, direction: 'out' as const })),
    ...linksTo
      .filter((l) => l.type === 'duplicates')
      .map((l) => ({ linkId: l.id, party: l.source, direction: 'in' as const })),
  ];
  const linkCount = linksFrom.length + linksTo.length;
  const pickerExclude = useMemo(() => {
    if (!issue) return [] as string[];
    return [
      issue.id,
      ...issue.linksFrom.map((l) => l.targetId),
      ...issue.linksTo.map((l) => l.sourceId),
    ];
  }, [issue]);

  const tabs: DrawerTab[] = ['details', 'links', 'files', 'comments', 'activity'];
  const currentType = isCreate ? draftType : (issue?.type ?? 'task');
  const currentPriority = isCreate ? draftPriority : (issue?.priority ?? 'medium');

  return (
    <div className="drawer-root">
      <button type="button" className="drawer-backdrop" aria-label="Close" onClick={onClose} />
      <aside
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label={isCreate ? 'Create issue' : 'Issue details'}
      >
        <header className="drawer-header">
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close drawer">
            ✕
          </button>
          {isCreate ? (
            <div className="drawer-header-meta">
              <span className="muted">New issue</span>
              <TypeBadge type={draftType} />
              <PriorityBadge priority={draftPriority} />
            </div>
          ) : issue ? (
            <div className="drawer-header-meta">
              <span className="issue-key">{issue.key}</span>
              <TypeBadge type={issue.type} />
              <PriorityBadge priority={issue.priority} />
              {issue.archivedAt ? (
                <span className="meta-chip archived" title="This issue is archived">
                  Archived
                </span>
              ) : null}
              {blockedBy.length > 0 ? (
                <span className="meta-chip warn" title="Blocked by open issues">
                  ⊘ {blockedBy.length}
                </span>
              ) : null}
            </div>
          ) : null}
        </header>

        {loading || (!isCreate && !issue) ? (
          <Loading label="Loading issue…" />
        ) : (
          <div className="drawer-body">
            <input
              className="drawer-title-input"
              value={title}
              autoFocus={isCreate}
              placeholder={isCreate ? 'Issue title' : undefined}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (!isCreate) void onSaveTitle();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
            />

            <div className="drawer-fields">
              <label>
                <span>Type</span>
                <select
                  value={currentType}
                  onChange={(e) => {
                    const next = e.target.value as IssueType;
                    if (isCreate) setDraftType(next);
                    else void saveFields({ type: next });
                  }}
                >
                  {(['task', 'bug', 'story'] as IssueType[]).map((t) => (
                    <option key={t} value={t}>
                      {typeLabel(t)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Priority</span>
                <select
                  value={currentPriority}
                  onChange={(e) => {
                    const next = e.target.value as IssuePriority;
                    if (isCreate) setDraftPriority(next);
                    else void saveFields({ priority: next });
                  }}
                >
                  {PRIORITY_ORDER.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Human effort (h)</span>
                {isCreate ? (
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={draftHumanEffort}
                    onChange={(e) => setDraftHumanEffort(e.target.value)}
                  />
                ) : (
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    defaultValue={issue!.humanEffort ?? ''}
                    key={`human-${issue!.id}-${issue!.humanEffort ?? 'x'}`}
                    onBlur={(e) => {
                      const raw = e.target.value.trim();
                      const next = raw === '' ? null : Number(raw);
                      if (raw !== '' && Number.isNaN(next)) return;
                      if (next === issue!.humanEffort) return;
                      void saveFields({ humanEffort: next });
                    }}
                  />
                )}
              </label>
              <label>
                <span>LOC effort</span>
                {isCreate ? (
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={draftLocEffort}
                    onChange={(e) => setDraftLocEffort(e.target.value)}
                  />
                ) : (
                  <input
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={issue!.locEffort ?? ''}
                    key={`loc-${issue!.id}-${issue!.locEffort ?? 'x'}`}
                    onBlur={(e) => {
                      const raw = e.target.value.trim();
                      const next = raw === '' ? null : Math.round(Number(raw));
                      if (raw !== '' && Number.isNaN(next)) return;
                      if (next === issue!.locEffort) return;
                      void saveFields({ locEffort: next });
                    }}
                  />
                )}
              </label>
              <label>
                <span>Due date</span>
                {isCreate ? (
                  <input
                    type="date"
                    value={draftDueDate}
                    onChange={(e) => setDraftDueDate(e.target.value)}
                  />
                ) : (
                  <input
                    type="date"
                    value={toDateInputValue(issue!.dueDate)}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === toDateInputValue(issue!.dueDate)) return;
                      void saveFields({ dueDate: next || null });
                    }}
                  />
                )}
              </label>
              <label>
                <span>Column</span>
                {isCreate ? (
                  <select
                    value={draftColumnId}
                    onChange={(e) => setDraftColumnId(e.target.value)}
                  >
                    {columns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input value={issue!.column.name} disabled />
                )}
              </label>
              {(isCreate || (issue && !issue.parentId)) ? (
                <label>
                  <span>Epic</span>
                  {isCreate ? (
                    <select
                      value={draftEpicId}
                      onChange={(e) => setDraftEpicId(e.target.value)}
                    >
                      <option value="">None</option>
                      {epics.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={issue!.epic?.id ?? ''}
                      onChange={(e) => {
                        const next = e.target.value || null;
                        void saveFields({ epicId: next });
                      }}
                    >
                      <option value="">None</option>
                      {epics.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              ) : null}
            </div>

            <div className="drawer-tabs">
              {tabs.map((t) => {
                const disabled = isCreate && t !== 'details';
                return (
                  <button
                    key={t}
                    type="button"
                    className={tab === t ? 'active' : ''}
                    disabled={disabled}
                    title={disabled ? 'Available after create' : undefined}
                    onClick={() => {
                      if (!disabled) setTab(t);
                    }}
                  >
                    {t}
                    {!isCreate && t === 'links' && linkCount > 0
                      ? ` (${linkCount})`
                      : ''}
                    {!isCreate && t === 'files' && attachments.length > 0
                      ? ` (${attachments.length})`
                      : ''}
                  </button>
                );
              })}
            </div>

            {tab === 'details' ? (
              <div className="drawer-section-stack">
                <section>
                  <h3>Description</h3>
                  <textarea
                    rows={2}
                    maxLength={300}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={() => {
                      if (!isCreate) void onSaveDescription();
                    }}
                    placeholder="Short summary (max 300 chars)…"
                  />
                </section>

                <section>
                  <h3>Document</h3>
                  {isCreate ? (
                    <MarkdownDocument
                      value={draftDocument.trim() ? draftDocument : null}
                      onSave={(next) => setDraftDocument(next ?? '')}
                      emptyLabel="Add a markdown plan/spec for this issue."
                    />
                  ) : (
                    <MarkdownDocument
                      value={issue?.document ?? null}
                      saving={saving}
                      onSave={(next) => saveFields({ document: next })}
                      emptyLabel="No document yet. Add the plan or spec in markdown."
                    />
                  )}
                </section>

                {!isCreate && issue ? (
                  <>
                    <section>
                      <h3>Labels</h3>
                      <div className="label-picker">
                        {labels.length === 0 ? (
                          <p className="muted">No project labels yet.</p>
                        ) : (
                          labels.map((l) => (
                            <button
                              key={l.id}
                              type="button"
                              className={`label-chip selectable${attachedIds.has(l.id) ? ' selected' : ''}`}
                              style={{ ['--label-color' as string]: l.color }}
                              onClick={() => void toggleLabel(l.id)}
                            >
                              {l.name}
                            </button>
                          ))
                        )}
                      </div>
                      <form
                        className="inline-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const fd = new FormData(form);
                          const name = String(fd.get('name') ?? '').trim();
                          if (!name) return;
                          void api
                            .createLabel(projectId, { name, color: nextLabelColor(labels) })
                            .then(async (label) => {
                              form.reset();
                              await api.attachLabel(issue.id, label.id);
                              await onChanged();
                              await load(issue.id);
                            })
                            .catch((err: unknown) =>
                              toast.push(
                                err instanceof ApiError ? err.message : 'Label create failed',
                                'error',
                              ),
                            );
                        }}
                      >
                        <input name="name" placeholder="New label name" maxLength={40} />
                        <button type="submit" className="btn btn-secondary">
                          Create
                        </button>
                      </form>
                    </section>

                    <section>
                      <h3>Subtasks</h3>
                      <ul className="simple-list">
                        {issue.subtasks.map((s) => (
                          <li key={s.id}>
                            <span className="issue-key">{s.key}</span>
                            <span>{s.title}</span>
                          </li>
                        ))}
                      </ul>
                      <form className="inline-form" onSubmit={(e) => void onAddSubtask(e)}>
                        <input
                          value={subtaskTitle}
                          onChange={(e) => setSubtaskTitle(e.target.value)}
                          placeholder="New subtask title"
                        />
                        <button type="submit" className="btn btn-secondary" disabled={saving}>
                          Add
                        </button>
                      </form>
                    </section>
                  </>
                ) : null}
              </div>
            ) : null}

            {!isCreate && tab === 'links' ? (
              <div className="drawer-section-stack">
                <section>
                  <h3>Blocked by</h3>
                  <p className="muted section-hint">
                    Issues that block this one. They should finish first.
                  </p>
                  <ul className="simple-list">
                    {blockedBy.map((b) => {
                      const linkId = blockedByLinkByIssueId.get(b.id);
                      return (
                        <li key={b.id}>
                          <span className="issue-key">{b.key}</span>
                          <TypeBadge type={b.type} />
                          <span>{b.title}</span>
                          {linkId ? (
                            <button
                              type="button"
                              className="link-btn"
                              onClick={() => void removeLink(linkId)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                    {blockedBy.length === 0 ? <li className="muted">None</li> : null}
                  </ul>
                  <IssueSearchPicker
                    projectId={projectId}
                    excludeIds={pickerExclude}
                    placeholder="Search issue to add as blocker…"
                    onPick={(item) => void onAddBlockedBy(item)}
                  />
                </section>

                <section>
                  <h3>Blocks</h3>
                  <p className="muted section-hint">Issues waiting on this one.</p>
                  <ul className="simple-list">
                    {blocks.map((b) => {
                      const linkId = blocksLinkByIssueId.get(b.id);
                      return (
                        <li key={b.id}>
                          <span className="issue-key">{b.key}</span>
                          <TypeBadge type={b.type} />
                          <span>{b.title}</span>
                          {linkId ? (
                            <button
                              type="button"
                              className="link-btn"
                              onClick={() => void removeLink(linkId)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                    {blocks.length === 0 ? <li className="muted">None</li> : null}
                  </ul>
                  <IssueSearchPicker
                    projectId={projectId}
                    excludeIds={pickerExclude}
                    placeholder="Search issue this blocks…"
                    onPick={(item) => void onAddBlocks(item)}
                  />
                </section>

                <section>
                  <h3>Related</h3>
                  <p className="muted section-hint">
                    Issues connected to this one, without a dependency.
                  </p>
                  <ul className="simple-list">
                    {related.map((r) => (
                      <li key={r.linkId}>
                        <span className="issue-key">{r.party.key}</span>
                        <TypeBadge type={r.party.type} />
                        <span>{r.party.title}</span>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => void removeLink(r.linkId)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                    {related.length === 0 ? <li className="muted">None</li> : null}
                  </ul>
                  <IssueSearchPicker
                    projectId={projectId}
                    excludeIds={pickerExclude}
                    placeholder="Search issue to relate…"
                    onPick={(item) => void onAddRelated(item)}
                  />
                </section>

                <section>
                  <h3>Duplicates</h3>
                  <p className="muted section-hint">
                    Issues covering the same work.
                  </p>
                  <ul className="simple-list">
                    {duplicates.map((d) => (
                      <li key={d.linkId}>
                        <span className="issue-key">{d.party.key}</span>
                        <TypeBadge type={d.party.type} />
                        <span>{d.party.title}</span>
                        <span className="muted">
                          {d.direction === 'out' ? 'duplicate of' : 'duplicated by'}
                        </span>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => void removeLink(d.linkId)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                    {duplicates.length === 0 ? <li className="muted">None</li> : null}
                  </ul>
                  <IssueSearchPicker
                    projectId={projectId}
                    excludeIds={pickerExclude}
                    placeholder="Search issue this duplicates…"
                    onPick={(item) => void onAddDuplicate(item)}
                  />
                </section>
              </div>
            ) : null}

            {!isCreate && tab === 'files' ? (
              <div className="drawer-section-stack">
                <section>
                  <h3>Attachments</h3>
                  <ul className="attachment-list">
                    {attachments.map((a) => (
                      <li key={a.id} className="attachment-item">
                        {a.mimeType.startsWith('image/') ? (
                          <a
                            href={api.attachmentDownloadUrl(a.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="attachment-thumb-link"
                          >
                            <img
                              src={api.attachmentDownloadUrl(a.id)}
                              alt={a.filename}
                              className="attachment-thumb"
                              loading="lazy"
                            />
                          </a>
                        ) : (
                          <span className="attachment-file-icon" aria-hidden>
                            📄
                          </span>
                        )}
                        <div className="attachment-meta">
                          <a
                            href={api.attachmentDownloadUrl(a.id)}
                            download={a.filename}
                            className="attachment-name"
                          >
                            {a.filename}
                          </a>
                          <span className="muted tiny">
                            {formatFileSize(a.size)} · {formatRelative(a.createdAt)}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => void onDeleteAttachment(a)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                    {attachments.length === 0 ? (
                      <li className="muted">No files attached.</li>
                    ) : null}
                  </ul>
                  <label className="attachment-upload">
                    <input
                      type="file"
                      disabled={uploading}
                      onChange={(e) => {
                        void onUploadFile(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                    <span className="btn btn-secondary">
                      {uploading ? 'Uploading…' : 'Upload file'}
                    </span>
                    <span className="muted tiny">Max 20 MB</span>
                  </label>
                </section>
              </div>
            ) : null}

            {!isCreate && tab === 'comments' ? (
              <div className="drawer-section-stack">
                <ul className="comment-list">
                  {comments.map((c) => (
                    <li key={c.id}>
                      <header>
                        <strong>{c.author.email}</strong>
                        <time>{formatRelative(c.createdAt)}</time>
                      </header>
                      <p>{c.body}</p>
                    </li>
                  ))}
                  {comments.length === 0 ? <li className="muted">No comments yet.</li> : null}
                </ul>
                <form className="stack-form" onSubmit={(e) => void onAddComment(e)}>
                  <textarea
                    rows={3}
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder="Write a comment…"
                  />
                  <button type="submit" className="btn btn-primary">
                    Comment
                  </button>
                </form>
              </div>
            ) : null}

            {!isCreate && tab === 'activity' ? (
              <ul className="activity-list">
                {activity.map((a) => (
                  <li key={a.id}>
                    <span className="activity-type">{activityLabel(a.type)}</span>
                    <span className="muted">
                      {a.actor?.email ?? 'system'} · {formatRelative(a.createdAt)}
                    </span>
                  </li>
                ))}
                {activity.length === 0 ? <li className="muted">No activity yet.</li> : null}
              </ul>
            ) : null}
          </div>
        )}

        {isCreate ? (
          <footer className="drawer-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving || !title.trim()}
              onClick={() => void onCreate()}
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
          </footer>
        ) : issue ? (
          <footer className="drawer-footer drawer-footer-danger">
            <button
              type="button"
              className="btn btn-ghost danger"
              disabled={saving}
              onClick={() => void onDelete()}
            >
              Delete
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={saving}
              title={
                issue.archivedAt
                  ? 'Put this issue back on the board'
                  : 'Hide from the board; restorable from Archived'
              }
              onClick={() => void onToggleArchive()}
            >
              {issue.archivedAt ? 'Restore' : 'Archive'}
            </button>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
