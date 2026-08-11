import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { CustomColumnType } from '../api/types';
import { useAnchoredMenu } from '../lib/useAnchoredMenu';

const MENU_WIDTH = 210;

export const COLUMN_TYPE_OPTIONS: {
  type: CustomColumnType;
  label: string;
  icon: string;
  hint: string;
}[] = [
  { type: 'text', label: 'Text', icon: '🔤', hint: 'Free text' },
  { type: 'number', label: 'Number', icon: '#', hint: 'Numeric value' },
  { type: 'date', label: 'Date', icon: '📅', hint: 'Calendar date' },
  { type: 'label', label: 'Label', icon: '🏷️', hint: 'Colored options' },
  { type: 'person', label: 'Person', icon: '👤', hint: 'Assign a user' },
  { type: 'file', label: 'File', icon: '📎', hint: 'Attach a file' },
  { type: 'checkbox', label: 'Checkbox', icon: '☑️', hint: 'Done / not done' },
];

/** Monday-style "+" header button opening the column-type menu. */
export function AddColumnMenu({ onAdd }: { onAdd: (type: CustomColumnType) => void }) {
  const { triggerRef, menuRef, open, setOpen, pos } = useAnchoredMenu(MENU_WIDTH);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="add-column-btn"
        title="Add column"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        +
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="label-menu"
              role="menu"
              aria-label="Add column"
              style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
            >
              <div className="list-fields-popover-title">Column type</div>
              <div className="label-menu-list">
                {COLUMN_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.type}
                    type="button"
                    role="menuitem"
                    className="header-menu-item"
                    title={opt.hint}
                    onClick={() => {
                      setOpen(false);
                      onAdd(opt.type);
                    }}
                  >
                    <span className="header-menu-icon" aria-hidden>
                      {opt.icon}
                    </span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** Per-column "⋯" menu with caller-provided actions (rename, delete, hide…). */
export function HeaderMenu({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: { label: string; danger?: boolean; onClick: () => void }[];
}) {
  const { triggerRef, menuRef, open, setOpen, pos } = useAnchoredMenu(MENU_WIDTH);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="th-menu-btn"
        title={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="label-menu"
              role="menu"
              aria-label={ariaLabel}
              style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
            >
              <div className="label-menu-list">
                {items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    className={`header-menu-item${item.danger ? ' danger' : ''}`}
                    onClick={() => {
                      setOpen(false);
                      item.onClick();
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** Drag handle on a header's right edge; reports live width and commit. */
export function ResizeHandle({
  width,
  min = 60,
  max = 1200,
  onLiveResize,
  onCommit,
}: {
  width: number;
  min?: number;
  max?: number;
  onLiveResize: (w: number) => void;
  onCommit: (w: number) => void;
}) {
  const drag = useRef<{ startX: number; startW: number; lastW: number } | null>(null);

  const clamp = (w: number) => Math.round(Math.min(max, Math.max(min, w)));

  const onPointerDown = (e: ReactPointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startW: width, lastW: width };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (!drag.current) return;
    const w = clamp(drag.current.startW + (e.clientX - drag.current.startX));
    if (w === drag.current.lastW) return;
    drag.current.lastW = w;
    onLiveResize(w);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (!drag.current) return;
    const w = drag.current.lastW;
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    onCommit(w);
  };

  return (
    <span
      className="col-resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize column"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
