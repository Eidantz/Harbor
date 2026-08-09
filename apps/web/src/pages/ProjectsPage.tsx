import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Project } from '../api/types';
import { ApiError } from '../api/types';
import { EmptyState, Loading } from '../components/Loading';
import { useToast } from '../components/Toast';
import { projectKeyFromName } from '../lib/projectKey';
import { applyDocumentTheme, DEFAULT_THEME } from '../theme/themes';

export function ProjectsPage() {
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyManual, setKeyManual] = useState(false);
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    applyDocumentTheme(DEFAULT_THEME);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      setProjects(await api.listProjects());
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onNameChange = (value: string) => {
    setName(value);
    if (!keyManual) setKey(projectKeyFromName(value));
  };

  const onKeyChange = (value: string) => {
    setKeyManual(true);
    setKey(value.toUpperCase());
  };

  const resetForm = () => {
    setName('');
    setKey('');
    setKeyManual(false);
    setDescription('');
    setShowForm(false);
  };

  const onDelete = async (project: Project) => {
    const confirmed = window.confirm(
      `Delete project ${project.key} (${project.name})?\n\nThis permanently removes all its columns, issues, epics, labels, comments, and activity. This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      await api.deleteProject(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      toast.push(`Deleted ${project.key}`, 'success');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Delete failed', 'error');
    }
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const project = await api.createProject({
        name: name.trim(),
        key: key.trim().toUpperCase(),
        description: description.trim() || undefined,
      });
      setProjects((prev) => [...prev, project]);
      resetForm();
      toast.push(`Created ${project.key}`, 'success');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Create failed', 'error');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <Loading label="Loading projects…" />;

  return (
    <main className="page projects-page">
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p className="muted">Pick a board or start a new keyspace.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            if (showForm) resetForm();
            else setShowForm(true);
          }}
        >
          {showForm ? 'Cancel' : 'New project'}
        </button>
      </div>

      {showForm ? (
        <form className="panel create-project-form" onSubmit={(e) => void onCreate(e)}>
          <label>
            <span>Name</span>
            <input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              required
              maxLength={120}
              placeholder="My Project"
            />
          </label>
          <label>
            <span>Key</span>
            <input
              value={key}
              onChange={(e) => onKeyChange(e.target.value)}
              required
              pattern="[A-Z][A-Z0-9]{1,9}"
              title="2–10 chars, start with a letter"
              placeholder="KAN"
            />
            <span className="field-hint muted tiny">
              {keyManual ? 'Edited manually' : 'Auto from name — edit to lock'}
            </span>
          </label>
          <label className="span-2">
            <span>Description</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </label>
          <div className="span-2 form-actions">
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      ) : null}

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          body="Create your first project to get a To Do / In Progress / Done board."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
              New project
            </button>
          }
        />
      ) : (
        <div className="project-list" role="table" aria-label="Projects">
          <div className="project-list-header" role="row">
            <span role="columnheader">Key</span>
            <span role="columnheader">Name</span>
            <span role="columnheader">Issues</span>
            <span role="columnheader">Description</span>
            <span role="columnheader" aria-label="Actions" />
          </div>
          <ul>
            {projects.map((p) => (
              <li key={p.id} role="row" className="project-list-item">
                <Link to={`/projects/${p.id}/board`} className="project-list-row">
                  <span className="issue-key">{p.key}</span>
                  <span className="project-list-name">{p.name}</span>
                  <span className="project-list-count">{p._count?.issues ?? 0}</span>
                  <span className="project-list-desc">
                    {p.description?.trim() || '—'}
                  </span>
                </Link>
                <button
                  type="button"
                  className="icon-btn tiny-icon danger-icon project-delete-btn"
                  title="Delete project"
                  aria-label={`Delete project ${p.name}`}
                  onClick={() => void onDelete(p)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
