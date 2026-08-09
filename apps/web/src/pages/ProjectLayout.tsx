import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Epic, Label, Project } from '../api/types';
import { ApiError } from '../api/types';
import { Loading } from '../components/Loading';
import { useToast } from '../components/Toast';
import { applyDocumentTheme, DEFAULT_THEME } from '../theme/themes';

export type ProjectContext = {
  project: Project;
  setProject: (project: Project) => void;
  labels: Label[];
  epics: Epic[];
  reloadMeta: () => Promise<void>;
};

export function ProjectLayout() {
  const { projectId = '' } = useParams();
  const toast = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const reloadMeta = async () => {
    const [p, l, e] = await Promise.all([
      api.getProject(projectId),
      api.listLabels(projectId),
      api.listEpics(projectId),
    ]);
    setProject(p);
    setLabels(l);
    setEpics(e);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMissing(false);
    void (async () => {
      try {
        const [p, l, e] = await Promise.all([
          api.getProject(projectId),
          api.listLabels(projectId),
          api.listEpics(projectId),
        ]);
        if (cancelled) return;
        setProject(p);
        setLabels(l);
        setEpics(e);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setMissing(true);
        else toast.push(err instanceof ApiError ? err.message : 'Failed to load project', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, toast]);

  useEffect(() => {
    if (!project) return;
    applyDocumentTheme(project.theme);
  }, [project?.theme]);

  useEffect(() => {
    return () => {
      applyDocumentTheme(DEFAULT_THEME);
    };
  }, []);

  if (loading) return <Loading label="Opening project…" />;
  if (missing || !project) return <Navigate to="/" replace />;

  return (
    <div className="project-shell">
      <div className="project-nav">
        <div className="project-nav-title">
          <span className="issue-key">{project.key}</span>
          <h1>{project.name}</h1>
        </div>
        <nav className="project-tabs">
          <NavLink
            to={`/projects/${projectId}/board`}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            Board
          </NavLink>
          <NavLink
            to={`/projects/${projectId}/epics`}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            Epics
          </NavLink>
        </nav>
      </div>
      <Outlet
        context={
          { project, setProject, labels, epics, reloadMeta } satisfies ProjectContext
        }
      />
    </div>
  );
}
