import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { SearchResultItem } from '../api/types';
import { TypeBadge } from './TypeBadge';

/**
 * Ctrl/Cmd+K global issue search. Searches every project and jumps to the
 * matching issue's board with its drawer open.
 */
export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('harbor:open-search', onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('harbor:open-search', onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQ('');
      setResults([]);
      setActiveIndex(0);
      setSearching(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (!query) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      void api
        .searchIssues(query)
        .then((res) => {
          setResults(res.items);
          setActiveIndex(0);
        })
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [q, open]);

  const pick = (item: SearchResultItem) => {
    setOpen(false);
    navigate(`/projects/${item.project.id}/board?issue=${item.id}`);
  };

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = results[activeIndex];
      if (item) pick(item);
    }
  };

  if (!open) return null;

  return (
    <div className="cmdk-root">
      <button
        type="button"
        className="cmdk-backdrop"
        aria-label="Close search"
        onClick={() => setOpen(false)}
      />
      <div className="cmdk-panel" role="dialog" aria-modal="true" aria-label="Search issues">
        <input
          ref={inputRef}
          className="cmdk-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onInputKey}
          placeholder="Search issues across all projects…"
          autoComplete="off"
          spellCheck={false}
        />
        <ul className="cmdk-results" role="listbox">
          {searching ? <li className="muted cmdk-hint">Searching…</li> : null}
          {!searching && q.trim() && results.length === 0 ? (
            <li className="muted cmdk-hint">No matching issues</li>
          ) : null}
          {!q.trim() ? (
            <li className="muted cmdk-hint">Type to search titles, keys, and descriptions</li>
          ) : null}
          {results.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`cmdk-option${index === activeIndex ? ' active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => pick(item)}
              >
                <span className="issue-key">{item.key}</span>
                <TypeBadge type={item.type} />
                <span className="cmdk-option-title">{item.title}</span>
                <span className="muted cmdk-option-meta">
                  {item.project.name} · {item.column.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <footer className="cmdk-footer muted tiny">
          ↑↓ navigate · Enter open · Esc close
        </footer>
      </div>
    </div>
  );
}
