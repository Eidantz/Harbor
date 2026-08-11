import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api/client';
import type {
  BoardIssue,
  CustomColumn,
  CustomLabelOption,
  CustomValuePayload,
  User,
} from '../api/types';
import { ApiError } from '../api/types';
import { contrastForeground } from '../lib/color';
import { useAnchoredMenu } from '../lib/useAnchoredMenu';
import { LABEL_COLOR_PALETTE, nextLabelColor, nextLabelName } from './LabelCell';
import { useToast } from './Toast';

const MENU_WIDTH = 248;

export type CustomCellHandlers = {
  setValue: (
    issueId: string,
    columnId: string,
    value: CustomValuePayload | null,
  ) => Promise<void>;
  updateSettings: (
    columnId: string,
    settings: CustomColumn['settings'],
  ) => Promise<void>;
};

function valueOf(issue: BoardIssue, columnId: string): CustomValuePayload | null {
  return issue.customValues?.find((v) => v.columnId === columnId)?.value ?? null;
}

function pillStyle(color: string): CSSProperties {
  return { background: color, color: contrastForeground(color) };
}

/* ── Label-type cell with per-column option set ─────────────────────── */

function OptionEditRow({
  option,
  paletteOpen,
  onTogglePalette,
  onChange,
  onDelete,
}: {
  option: CustomLabelOption;
  paletteOpen: boolean;
  onTogglePalette: () => void;
  onChange: (patch: Partial<CustomLabelOption>) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(option.name);

  const commit = () => {
    const next = draft.trim();
    if (!next || next === option.name) {
      setDraft(option.name);
      return;
    }
    onChange({ name: next });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      setDraft(option.name);
    }
  };

  return (
    <div className="label-edit-item">
      <div className="label-edit-row">
        <button
          type="button"
          className="label-edit-swatch"
          style={{ background: option.color }}
          title="Change color"
          aria-label={`Change color for ${option.name}`}
          aria-expanded={paletteOpen}
          onClick={onTogglePalette}
        />
        <input
          className="label-edit-input"
          value={draft}
          maxLength={40}
          aria-label={`Rename ${option.name}`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="label-edit-delete"
          title={`Delete ${option.name}`}
          aria-label={`Delete ${option.name}`}
          onClick={onDelete}
        >
          ×
        </button>
      </div>
      {paletteOpen ? (
        <div className="label-palette" role="listbox" aria-label="Option colors">
          {LABEL_COLOR_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              className={`label-palette-swatch${
                color.toUpperCase() === option.color.toUpperCase() ? ' selected' : ''
              }`}
              style={{ background: color }}
              title={color}
              onClick={() => {
                onTogglePalette();
                onChange({ color });
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function OptionCell({
  issue,
  column,
  handlers,
}: {
  issue: BoardIssue;
  column: CustomColumn;
  handlers: CustomCellHandlers;
}) {
  const { triggerRef, menuRef, open, setOpen, pos } = useAnchoredMenu(MENU_WIDTH);
  const [editing, setEditing] = useState(false);
  const [paletteFor, setPaletteFor] = useState<string | null>(null);

  const options = column.settings.options ?? [];
  const value = valueOf(issue, column.id);
  const optionId = value && 'optionId' in value ? value.optionId : null;
  const selected = optionId ? options.find((o) => o.id === optionId) ?? null : null;

  const saveOptions = (next: CustomLabelOption[]) =>
    void handlers.updateSettings(column.id, { ...column.settings, options: next });

  const addOption = () => {
    const next: CustomLabelOption = {
      id: crypto.randomUUID(),
      name: nextLabelName(options),
      color: nextLabelColor(options),
    };
    saveOptions([...options, next]);
    setEditing(true);
  };

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`label-cell-trigger${selected ? '' : ' empty'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${column.name} for ${issue.key}`}
        onClick={() => setOpen((v) => !v)}
      >
        {selected ? (
          <span className="label-cell-pill" style={pillStyle(selected.color)} title={selected.name}>
            {selected.name}
          </span>
        ) : (
          <span className="label-cell-pill label-cell-placeholder" aria-hidden>
            +
          </span>
        )}
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="label-menu"
              role="dialog"
              aria-label={`Pick ${column.name}`}
              style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
            >
              {editing ? (
                <>
                  <div className="label-menu-list">
                    {options.map((o) => (
                      <OptionEditRow
                        key={o.id}
                        option={o}
                        paletteOpen={paletteFor === o.id}
                        onTogglePalette={() =>
                          setPaletteFor((cur) => (cur === o.id ? null : o.id))
                        }
                        onChange={(patch) =>
                          saveOptions(options.map((x) => (x.id === o.id ? { ...x, ...patch } : x)))
                        }
                        onDelete={() => saveOptions(options.filter((x) => x.id !== o.id))}
                      />
                    ))}
                  </div>
                  <button type="button" className="label-menu-new" onClick={addOption}>
                    + New label
                  </button>
                  <div className="label-menu-footer">
                    <button
                      type="button"
                      className="label-menu-apply"
                      onClick={() => setEditing(false)}
                    >
                      Apply
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="label-menu-list">
                    {options.length === 0 ? (
                      <p className="label-menu-empty">No labels yet</p>
                    ) : (
                      options.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          className={`label-option${o.id === optionId ? ' selected' : ''}`}
                          style={pillStyle(o.color)}
                          aria-pressed={o.id === optionId}
                          onClick={() => {
                            setOpen(false);
                            void handlers.setValue(
                              issue.id,
                              column.id,
                              o.id === optionId ? null : { optionId: o.id },
                            );
                          }}
                        >
                          <span className="label-option-name">{o.name}</span>
                          {o.id === optionId ? (
                            <span className="label-option-check" aria-hidden>
                              ✓
                            </span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                  <div className="label-menu-footer">
                    <button
                      type="button"
                      className="label-menu-edit-btn"
                      onClick={() => setEditing(true)}
                    >
                      ✎ Edit labels
                    </button>
                  </div>
                </>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/* ── Person cell ────────────────────────────────────────────────────── */

function PersonCell({
  issue,
  column,
  users,
  handlers,
}: {
  issue: BoardIssue;
  column: CustomColumn;
  users: User[];
  handlers: CustomCellHandlers;
}) {
  const { triggerRef, menuRef, open, setOpen, pos } = useAnchoredMenu(MENU_WIDTH);
  const value = valueOf(issue, column.id);
  const userId = value && 'userId' in value ? value.userId : null;
  const selected = userId ? users.find((u) => u.id === userId) ?? null : null;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="person-cell-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${column.name} for ${issue.key}`}
        title={selected?.email ?? 'Assign person'}
        onClick={() => setOpen((v) => !v)}
      >
        {selected ? (
          <span className="owner-avatar">{selected.email.slice(0, 1).toUpperCase()}</span>
        ) : (
          <span className="owner-avatar empty" aria-hidden>
            ●
          </span>
        )}
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="label-menu"
              role="dialog"
              aria-label={`Pick ${column.name}`}
              style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
            >
              <div className="label-menu-list">
                {users.length === 0 ? (
                  <p className="label-menu-empty">No users</p>
                ) : (
                  users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className={`person-option${u.id === userId ? ' selected' : ''}`}
                      onClick={() => {
                        setOpen(false);
                        void handlers.setValue(
                          issue.id,
                          column.id,
                          u.id === userId ? null : { userId: u.id },
                        );
                      }}
                    >
                      <span className="owner-avatar">{u.email.slice(0, 1).toUpperCase()}</span>
                      <span className="person-option-email">{u.email}</span>
                      {u.id === userId ? <span aria-hidden>✓</span> : null}
                    </button>
                  ))
                )}
              </div>
              {userId ? (
                <div className="label-menu-footer">
                  <button
                    type="button"
                    className="label-menu-new"
                    onClick={() => {
                      setOpen(false);
                      void handlers.setValue(issue.id, column.id, null);
                    }}
                  >
                    Clear
                  </button>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/* ── File cell ──────────────────────────────────────────────────────── */

function FileCell({
  issue,
  column,
  handlers,
}: {
  issue: BoardIssue;
  column: CustomColumn;
  handlers: CustomCellHandlers;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const value = valueOf(issue, column.id);
  const file = value && 'attachmentId' in value ? value : null;

  const onPick = async (picked: File | null | undefined) => {
    if (!picked) return;
    setUploading(true);
    try {
      const attachment = await api.uploadAttachment(issue.id, picked);
      await handlers.setValue(issue.id, column.id, {
        attachmentId: attachment.id,
        filename: attachment.filename,
      });
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  if (file) {
    return (
      <span className="file-cell">
        <a
          className="file-cell-link"
          href={api.attachmentDownloadUrl(file.attachmentId)}
          title={file.filename}
        >
          📎 {file.filename}
        </a>
        <button
          type="button"
          className="file-cell-clear"
          title="Remove file"
          aria-label={`Remove file from ${column.name}`}
          onClick={() => void handlers.setValue(issue.id, column.id, null)}
        >
          ×
        </button>
      </span>
    );
  }

  return (
    <span className="file-cell">
      <button
        type="button"
        className="file-cell-upload"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        aria-label={`Upload file for ${column.name}`}
      >
        {uploading ? 'Uploading…' : '📎 +'}
      </button>
      <input
        ref={inputRef}
        type="file"
        hidden
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
    </span>
  );
}

/* ── Dispatcher ─────────────────────────────────────────────────────── */

export function CustomCell({
  issue,
  column,
  users,
  handlers,
}: {
  issue: BoardIssue;
  column: CustomColumn;
  users: User[];
  handlers: CustomCellHandlers;
}) {
  const value = valueOf(issue, column.id);

  switch (column.type) {
    case 'text': {
      const text = value && 'text' in value ? value.text : '';
      return (
        <input
          className="monday-cell-input monday-custom-text"
          type="text"
          placeholder="—"
          maxLength={2000}
          defaultValue={text}
          key={`${issue.id}-${column.id}-${text}`}
          aria-label={`${column.name} for ${issue.key}`}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next === text) return;
            void handlers.setValue(issue.id, column.id, next ? { text: next } : null);
          }}
        />
      );
    }
    case 'number': {
      const num = value && 'number' in value ? value.number : null;
      return (
        <input
          className="monday-cell-input"
          type="number"
          placeholder="—"
          defaultValue={num ?? ''}
          key={`${issue.id}-${column.id}-${num ?? 'x'}`}
          aria-label={`${column.name} for ${issue.key}`}
          onBlur={(e) => {
            const raw = e.target.value.trim();
            const next = raw === '' ? null : Number(raw);
            if (raw !== '' && Number.isNaN(next)) return;
            if (next === num) return;
            void handlers.setValue(
              issue.id,
              column.id,
              next === null ? null : { number: next },
            );
          }}
        />
      );
    }
    case 'date': {
      const date = value && 'date' in value ? value.date.slice(0, 10) : '';
      return (
        <input
          className="monday-cell-input monday-date-input"
          type="date"
          value={date}
          aria-label={`${column.name} for ${issue.key}`}
          onChange={(e) => {
            const next = e.target.value;
            if (next === date) return;
            void handlers.setValue(issue.id, column.id, next ? { date: next } : null);
          }}
        />
      );
    }
    case 'checkbox': {
      const checked = value !== null && 'checked' in value ? value.checked : false;
      return (
        <input
          className="monday-checkbox"
          type="checkbox"
          checked={checked}
          aria-label={`${column.name} for ${issue.key}`}
          onChange={(e) =>
            void handlers.setValue(issue.id, column.id, { checked: e.target.checked })
          }
        />
      );
    }
    case 'label':
      return <OptionCell issue={issue} column={column} handlers={handlers} />;
    case 'person':
      return <PersonCell issue={issue} column={column} users={users} handlers={handlers} />;
    case 'file':
      return <FileCell issue={issue} column={column} handlers={handlers} />;
  }
}
