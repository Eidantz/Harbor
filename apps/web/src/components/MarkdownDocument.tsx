import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

/**
 * Rendered markdown view with an edit toggle (textarea + Save/Cancel).
 * `onSave` receives the trimmed content, or null when cleared.
 */
export function MarkdownDocument({
  value,
  onSave,
  saving,
  emptyLabel = 'No document yet.',
}: {
  value: string | null;
  onSave: (next: string | null) => void | Promise<void>;
  saving?: boolean;
  emptyLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    if (!editing) setDraft(value ?? '');
  }, [value, editing]);

  const save = async () => {
    await onSave(draft.trim() || null);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="markdown-doc">
        <textarea
          className="markdown-doc-editor"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={'Write markdown…\n\n# Heading\n- list item\n```code```'}
          autoFocus
        />
        <div className="markdown-doc-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={saving}
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="markdown-doc">
      {value ? <Markdown>{value}</Markdown> : <p className="muted">{emptyLabel}</p>}
      <div className="markdown-doc-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setEditing(true)}
        >
          {value ? 'Edit document' : 'Add document'}
        </button>
      </div>
    </div>
  );
}
