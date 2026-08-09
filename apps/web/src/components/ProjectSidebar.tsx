import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import type { Project } from '../api/types';

const COLLAPSE_KEY = 'harbor.projectSidebar.collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export function ProjectSidebar() {
  const location = useLocation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    let cancelled = false;
    void api
      .listProjects()
      .then((list) => {
        if (!cancelled) setProjects(list);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <aside
      className={`project-sidebar${collapsed ? ' is-collapsed' : ''}`}
      aria-label="Projects"
    >
      <div className="project-sidebar-header">
        <span className="project-sidebar-title">Projects</span>
        <button
          type="button"
          className="icon-btn tiny-icon"
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? '▸' : '◂'}
        </button>
      </div>
      <ul className="project-sidebar-list">
        {projects.length === 0 ? (
          <li className="project-sidebar-empty">No projects</li>
        ) : (
          projects.map((p) => (
            <li key={p.id}>
              <NavLink
                to={`/projects/${p.id}/board`}
                className={({ isActive }) =>
                  `project-sidebar-link${isActive ? ' active' : ''}`
                }
                title={p.name}
              >
                <span className="issue-key">{p.key}</span>
                <span className="project-sidebar-name">{p.name}</span>
              </NavLink>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}
