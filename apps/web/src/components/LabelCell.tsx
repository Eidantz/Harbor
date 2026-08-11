import { useEffect, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { BoardIssue, Label } from '../api/types';
import { contrastForeground } from '../lib/color';
import { useAnchoredMenu } from '../lib/useAnchoredMenu';

/** Monday.com label palette. */
export const LABEL_COLOR_PALETTE = [
  '#00C875',
  '#9CD326',
  '#CAB641',
  '#FFCB00',
  '#FDAB3D',
  '#FF642E',
  '#DF2F4A',
  '#BB3354',
  '#FF158A',
  '#FF5AC4',
  '#784BD1',
  '#A25DDC',
  '#0086C0',
  '#579BFC',
  '#66CCFF',
  '#7F5347',
  '#C4C4C4',
  '#808080',
] as const;

export function nextLabelColor(labels: { color: string }[]): string {
  const used = new Set(labels.map((l) => l.color.toUpperCase()));
  return (
    LABEL_COLOR_PALETTE.find((c) => !used.has(c)) ??
    LABEL_COLOR_PALETTE[labels.length % LABEL_COLOR_PALETTE.length]
  );
}

export function nextLabelName(labels: { name: string }[], base = 'New label'): string {
  const names = new Set(labels.map((l) => l.name.toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  for (let n = 2; ; n += 1) {
    if (!names.has(`${base.toLowerCase()} ${n}`)) return `${base} ${n}`;
  }
}

export type LabelActions = {
  toggle: (issueId: string, label: Label, attach: boolean) => Promise<void>;
  create: (name: string, color: string) => Promise<Label | null>;
  update: (labelId: string, patch: { name?: string; color?: string }) => Promise<void>;
  remove: (label: Label) => Promise<void>;
};

const MENU_WIDTH = 248;

function pillStyle(color: string): CSSProperties {
  return { background: color, color: contrastForeground(color) };
}

function LabelEditRow({
  label,
  paletteOpen,
  onTogglePalette,
  actions,
}: {
  label: Label;
  paletteOpen: boolean;
  onTogglePalette: () => void;
  actions: LabelActions;
}) {
  const [draft, setDraft] = useState(label.name);

  useEffect(() => {
    setDraft(label.name);
  }, [label.name]);

  const commit = () => {
    const next = draft.trim();
    if (!next || next === label.name) {
      setDraft(label.name);
      return;
    }
    void actions.update(label.id, { name: next });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      setDraft(label.name);
    }
  };

  return (
    <div className="label-edit-item">
      <div className="label-edit-row">
        <button
          type="button"
          className="label-edit-swatch"
          style={{ background: label.color }}
          title="Change color"
          aria-label={`Change color for ${label.name}`}
          aria-expanded={paletteOpen}
          onClick={onTogglePalette}
        />
        <input
          className="label-edit-input"
          value={draft}
          maxLength={40}
          aria-label={`Rename ${label.name}`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="label-edit-delete"
          title={`Delete ${label.name}`}
          aria-label={`Delete ${label.name}`}
          onClick={() => void actions.remove(label)}
        >
          ×
        </button>
      </div>
      {paletteOpen ? (
        <div className="label-palette" role="listbox" aria-label="Label colors">
          {LABEL_COLOR_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              className={`label-palette-swatch${
                color.toUpperCase() === label.color.toUpperCase() ? ' selected' : ''
              }`}
              style={{ background: color }}
              title={color}
              onClick={() => {
                onTogglePalette();
                void actions.update(label.id, { color });
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function LabelCell({
  issue,
  labels,
  actions,
}: {
  issue: BoardIssue;
  labels: Label[];
  actions: LabelActions;
}) {
  const { triggerRef, menuRef, open, setOpen, pos } = useAnchoredMenu(MENU_WIDTH);
  const [editing, setEditing] = useState(false);
  const [paletteFor, setPaletteFor] = useState<string | null>(null);

  const attachedIds = new Set(issue.labels.map((l) => l.labelId));

  useEffect(() => {
    if (!open) {
      setEditing(false);
      setPaletteFor(null);
    }
  }, [open]);

  const onNewLabel = async () => {
    const label = await actions.create(nextLabelName(labels), nextLabelColor(labels));
    if (label) {
      setEditing(true);
      await actions.toggle(issue.id, label, true);
    }
  };

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`label-cell-trigger${issue.labels.length === 0 ? ' empty' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Labels for ${issue.key}`}
        onClick={() => setOpen((v) => !v)}
      >
        {issue.labels.length === 0 ? (
          <span className="label-cell-pill label-cell-placeholder" aria-hidden>
            +
          </span>
        ) : (
          issue.labels.map((l) => (
            <span
              key={l.labelId}
              className="label-cell-pill"
              style={pillStyle(l.label.color)}
              title={l.label.name}
            >
              {l.label.name}
            </span>
          ))
        )}
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="label-menu"
              role="dialog"
              aria-label="Pick labels"
              style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
            >
              {editing ? (
                <>
                  <div className="label-menu-list">
                    {labels.map((l) => (
                      <LabelEditRow
                        key={l.id}
                        label={l}
                        actions={actions}
                        paletteOpen={paletteFor === l.id}
                        onTogglePalette={() =>
                          setPaletteFor((cur) => (cur === l.id ? null : l.id))
                        }
                      />
                    ))}
                  </div>
                  <button type="button" className="label-menu-new" onClick={() => void onNewLabel()}>
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
                    {labels.length === 0 ? (
                      <p className="label-menu-empty">No labels yet</p>
                    ) : (
                      labels.map((l) => {
                        const attached = attachedIds.has(l.id);
                        return (
                          <button
                            key={l.id}
                            type="button"
                            className={`label-option${attached ? ' selected' : ''}`}
                            style={pillStyle(l.color)}
                            aria-pressed={attached}
                            onClick={() => void actions.toggle(issue.id, l, !attached)}
                          >
                            <span className="label-option-name">{l.name}</span>
                            {attached ? (
                              <span className="label-option-check" aria-hidden>
                                ✓
                              </span>
                            ) : null}
                          </button>
                        );
                      })
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
