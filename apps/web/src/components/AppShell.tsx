import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { BrandMark } from './BrandMark';
import { CommandPalette } from './CommandPalette';
import { ProjectSidebar } from './ProjectSidebar';

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <NavLink to="/" className="brand-mark">
            <BrandMark size="sm" />
            <span className="brand-name">Harbor</span>
          </NavLink>
          <span className="brand-tag">Local Kanban</span>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="topbar-search-btn"
            title="Search issues (Ctrl+K)"
            onClick={() => window.dispatchEvent(new CustomEvent('harbor:open-search'))}
          >
            <span aria-hidden>⌕</span>
            <span>Search</span>
            <kbd>Ctrl K</kbd>
          </button>
          {user ? (
            <div className="user-menu" ref={menuRef}>
              <button
                type="button"
                className="user-chip"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <span>{user.email}</span>
                <span className="user-chip-caret" aria-hidden>
                  ▾
                </span>
              </button>
              {menuOpen ? (
                <div className="user-menu-popover" role="menu">
                  <NavLink
                    to="/settings"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                  >
                    MCP tokens
                  </NavLink>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      void logout().then(() => navigate('/auth', { replace: true }));
                    }}
                  >
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>
      <div className="app-body">
        <ProjectSidebar />
        <div className="app-main">
          <Outlet />
        </div>
      </div>
      <CommandPalette />
    </div>
  );
}
