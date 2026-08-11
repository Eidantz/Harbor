import { type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { contrastForeground } from '../lib/color';
import { useAnchoredMenu } from '../lib/useAnchoredMenu';

const MENU_WIDTH = 220;
const FALLBACK_COLOR = '#6B7280';

export type PickerOption = { id: string; name: string; color: string | null };

function pillStyle(color: string | null): CSSProperties {
  const bg = color ?? FALLBACK_COLOR;
  return { background: bg, color: contrastForeground(bg) };
}

/**
 * Monday-style single-select cell: a colored block that opens a dropdown of
 * colored options (used for Status = board column, and Epic).
 */
export function PickerCell({
  value,
  options,
  ariaLabel,
  clearLabel,
  onSelect,
}: {
  value: string | null;
  options: PickerOption[];
  ariaLabel: string;
  /** When set, shows a "clear" option that selects null (e.g. "No epic"). */
  clearLabel?: string;
  onSelect: (id: string | null) => void;
}) {
  const { triggerRef, menuRef, open, setOpen, pos } = useAnchoredMenu(MENU_WIDTH);
  const selected = value ? options.find((o) => o.id === value) ?? null : null;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`label-cell-trigger${selected ? '' : ' empty'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
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
              aria-label={ariaLabel}
              style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
            >
              <div className="label-menu-list">
                {options.length === 0 ? (
                  <p className="label-menu-empty">No options yet</p>
                ) : (
                  options.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className={`label-option${o.id === value ? ' selected' : ''}`}
                      style={pillStyle(o.color)}
                      aria-pressed={o.id === value}
                      onClick={() => {
                        setOpen(false);
                        if (o.id !== value) onSelect(o.id);
                      }}
                    >
                      <span className="label-option-name">{o.name}</span>
                      {o.id === value ? (
                        <span className="label-option-check" aria-hidden>
                          ✓
                        </span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
              {clearLabel && value ? (
                <div className="label-menu-footer">
                  <button
                    type="button"
                    className="label-menu-new"
                    onClick={() => {
                      setOpen(false);
                      onSelect(null);
                    }}
                  >
                    {clearLabel}
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
