import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { ApiTokenMeta, CreatedApiToken } from '../api/types';
import { ApiError } from '../api/types';
import { Loading } from '../components/Loading';
import { useToast } from '../components/Toast';
import { formatRelative } from '../lib/format';
import { applyDocumentTheme, DEFAULT_THEME } from '../theme/themes';

export function SettingsPage() {
  const toast = useToast();
  const [tokens, setTokens] = useState<ApiTokenMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('Cursor MCP');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedApiToken | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setTokens(await api.listTokens());
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed to load tokens', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    applyDocumentTheme(DEFAULT_THEME);
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreated(null);
    setCopied(false);
    try {
      const row = await api.createToken(name.trim() || 'MCP');
      setCreated(row);
      setTokens((prev) => [
        {
          id: row.id,
          name: row.name,
          prefix: row.prefix,
          createdAt: row.createdAt,
          lastUsedAt: row.lastUsedAt,
        },
        ...prev,
      ]);
      toast.push('Token created — copy it now', 'success');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Create failed', 'error');
    } finally {
      setCreating(false);
    }
  };

  const onCopy = async () => {
    if (!created?.token) return;
    try {
      await navigator.clipboard.writeText(created.token);
      setCopied(true);
      toast.push('Copied to clipboard', 'success');
    } catch {
      toast.push('Could not copy — select the token manually', 'error');
    }
  };

  const onRevoke = async (id: string) => {
    if (!confirm('Revoke this token? The MCP will stop working until you create a new one.')) {
      return;
    }
    try {
      await api.revokeToken(id);
      setTokens((prev) => prev.filter((t) => t.id !== id));
      if (created?.id === id) setCreated(null);
      toast.push('Token revoked', 'success');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Revoke failed', 'error');
    }
  };

  if (loading) return <Loading label="Loading settings…" />;

  return (
    <main className="page settings-page">
      <div className="page-header">
        <div>
          <h1>MCP tokens</h1>
          <p className="muted">
            Create a Bearer token for Claude Code / Cursor MCP. Paste the snippet below into your
            client config (use an absolute path to <code>apps/mcp/dist/index.js</code>), then
            reload MCP servers. Prefer <code>127.0.0.1</code> over <code>localhost</code> so
            macOS does not hang on IPv6.
          </p>
        </div>
      </div>

      <section className="panel">
        <h2 className="panel-title">Create token</h2>
        <form className="stack-form token-create-form" onSubmit={(e) => void onCreate(e)}>
          <label>
            <span>Label</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Claude Code MCP"
              maxLength={80}
              required
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create token'}
          </button>
        </form>

        {created ? (
          <div className="token-reveal" role="status">
            <p>
              <strong>Copy this token now.</strong> It won’t be shown again.
            </p>
            <code className="token-value">{created.token}</code>
            <div className="token-reveal-actions">
              <button type="button" className="btn btn-primary" onClick={() => void onCopy()}>
                {copied ? 'Copied' : 'Copy token'}
              </button>
            </div>
            <pre className="token-snippet">{`{
  "mcpServers": {
    "harbor-kanban-board": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/Harbor/apps/mcp/dist/index.js"],
      "env": {
        "KANBAN_API_URL": "http://127.0.0.1:3001",
        "KANBAN_API_TOKEN": "${created.token}"
      }
    }
  }
}`}</pre>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2 className="panel-title">Active tokens</h2>
        {tokens.length === 0 ? (
          <p className="muted">No tokens yet. Create one for the Harbor MCP.</p>
        ) : (
          <ul className="token-list">
            {tokens.map((t) => (
              <li key={t.id} className="token-row">
                <div>
                  <strong>{t.name}</strong>
                  <p className="muted">
                    <code>{t.prefix}…</code>
                    {' · '}
                    created {formatRelative(t.createdAt)}
                    {t.lastUsedAt ? ` · last used ${formatRelative(t.lastUsedAt)}` : ' · never used'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost danger"
                  onClick={() => void onRevoke(t.id)}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
