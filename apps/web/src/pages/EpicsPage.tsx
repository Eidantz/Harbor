import { useEffect, useState, type FormEvent } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Epic } from '../api/types';
import { ApiError } from '../api/types';
import { ColorPicker } from '../components/ColorPicker';
import { Loading } from '../components/Loading';
import { MarkdownDocument } from '../components/MarkdownDocument';
import { useToast } from '../components/Toast';
import { contrastForeground } from '../lib/color';
import type { ProjectContext } from './ProjectLayout';

const DEFAULT_EPIC_COLOR = '#7aa2f7';

export function EpicsPage() {
  const { projectId = '' } = useParams();
  const { reloadMeta } = useOutletContext<ProjectContext>();
  const toast = useToast();
  const [epics, setEpics] = useState<Epic[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Epic | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_EPIC_COLOR);
  const [newDescription, setNewDescription] = useState('');
  const [newDocument, setNewDocument] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(DEFAULT_EPIC_COLOR);
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const list = await api.listEpics(projectId);
    setEpics(list);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void load()
      .catch((err: unknown) => {
        if (!cancelled) {
          toast.push(err instanceof ApiError ? err.message : 'Failed to load epics', 'error');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on project change
  }, [projectId]);

  const expand = async (epicId: string) => {
    if (expandedId === epicId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(epicId);
    try {
      const epic = await api.getEpic(epicId);
      setDetail(epic);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed to load epic', 'error');
    }
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await api.createEpic(projectId, {
        name: newName.trim(),
        color: newColor,
        description: newDescription.trim() || undefined,
        document: newDocument.trim() || undefined,
      });
      setNewName('');
      setNewDescription('');
      setNewDocument('');
      setNewColor(DEFAULT_EPIC_COLOR);
      setCreating(false);
      await load();
      await reloadMeta();
      toast.push('Epic created', 'success');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Create failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (epic: Epic) => {
    setEditingId(epic.id);
    setEditName(epic.name);
    setEditColor(epic.color);
    setEditDescription(epic.description ?? '');
  };

  const onSaveEdit = async (epicId: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await api.updateEpic(epicId, {
        name: editName.trim(),
        color: editColor,
        description: editDescription.trim() || null,
      });
      setEditingId(null);
      await load();
      if (expandedId === epicId) {
        setDetail(await api.getEpic(epicId));
      }
      await reloadMeta();
      toast.push('Epic updated', 'success');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onSaveDocument = async (epicId: string, next: string | null) => {
    setSaving(true);
    try {
      await api.updateEpic(epicId, { document: next });
      setDetail(await api.getEpic(epicId));
      await load();
      toast.push('Document saved', 'success');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (epic: Epic) => {
    if (!window.confirm(`Delete epic “${epic.name}”? Linked issues keep their other fields.`)) {
      return;
    }
    setSaving(true);
    try {
      await api.deleteEpic(epic.id);
      if (expandedId === epic.id) {
        setExpandedId(null);
        setDetail(null);
      }
      await load();
      await reloadMeta();
      toast.push('Epic deleted', 'success');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Delete failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading label="Loading epics…" />;

  return (
    <main className="epics-page">
      <div className="epics-page-header">
        <div>
          <h2>Epics</h2>
          <p className="muted">
            Group top-level board issues under an epic. Epics are not board cards.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setCreating((v) => !v)}
        >
          {creating ? 'Cancel' : '+ New epic'}
        </button>
      </div>

      {creating ? (
        <form className="epics-create-form" onSubmit={(e) => void onCreate(e)}>
          <label>
            <span>Name</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Epic name"
              maxLength={120}
              autoFocus
              required
            />
          </label>
          <label>
            <span>Description</span>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Short summary (max 300 chars, optional)"
              maxLength={300}
              rows={2}
            />
          </label>
          <label>
            <span>Document (markdown)</span>
            <textarea
              value={newDocument}
              onChange={(e) => setNewDocument(e.target.value)}
              placeholder="Optional long-form plan/spec in markdown"
              rows={6}
            />
          </label>
          <div className="epics-color-field">
            <span>Color</span>
            <ColorPicker
              value={newColor}
              onChange={(hex) => {
                if (hex) setNewColor(hex);
              }}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving || !newName.trim()}>
            Create
          </button>
        </form>
      ) : null}

      {epics.length === 0 ? (
        <p className="muted epics-empty">No epics yet. Create one to group related issues.</p>
      ) : (
        <ul className="epics-list">
          {epics.map((epic) => {
            const count = epic._count?.issues ?? 0;
            const isOpen = expandedId === epic.id;
            const isEditing = editingId === epic.id;
            return (
              <li key={epic.id} className="epics-list-item">
                <div className="epics-list-row">
                  <button
                    type="button"
                    className="epics-expand-btn"
                    onClick={() => void expand(epic.id)}
                    aria-expanded={isOpen}
                  >
                    <span
                      className="epics-swatch"
                      style={{
                        backgroundColor: epic.color,
                        color: contrastForeground(epic.color),
                      }}
                      aria-hidden
                    />
                    <span className="epics-name">{epic.name}</span>
                    <span className="muted">
                      {count} {count === 1 ? 'issue' : 'issues'}
                    </span>
                  </button>
                  <div className="epics-row-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => startEdit(epic)}
                      disabled={saving}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost danger"
                      onClick={() => void onDelete(epic)}
                      disabled={saving}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="epics-edit-form">
                    <label>
                      <span>Name</span>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={120}
                      />
                    </label>
                    <label>
                      <span>Description</span>
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Short summary (max 300 chars)"
                        maxLength={300}
                        rows={2}
                      />
                    </label>
                    <div className="epics-color-field">
                      <span>Color</span>
                      <ColorPicker
                        value={editColor}
                        onChange={(hex) => {
                          if (hex) setEditColor(hex);
                        }}
                      />
                    </div>
                    <div className="epics-row-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={saving || !editName.trim()}
                        onClick={() => void onSaveEdit(epic.id)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {isOpen ? (
                  <div className="epics-detail">
                    {detail?.id === epic.id ? (
                      <>
                        {detail.description ? (
                          <p className="muted">{detail.description}</p>
                        ) : null}
                        <MarkdownDocument
                          value={detail.document ?? null}
                          saving={saving}
                          onSave={(next) => onSaveDocument(epic.id, next)}
                          emptyLabel="No document yet. Add the plan or spec in markdown."
                        />
                        {(detail.issues?.length ?? 0) === 0 ? (
                          <p className="muted">No linked issues yet.</p>
                        ) : (
                          <ul className="epics-issue-list">
                            {detail.issues!.map((issue) => (
                              <li key={issue.id}>
                                <Link
                                  to={`/projects/${projectId}/board?issue=${issue.id}`}
                                  className="epics-issue-link"
                                >
                                  <span className="issue-key">{issue.key}</span>
                                  <span>{issue.title}</span>
                                  {issue.column ? (
                                    <span className="muted">{issue.column.name}</span>
                                  ) : null}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <Loading label="Loading…" />
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
