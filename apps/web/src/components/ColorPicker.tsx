import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = light - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHue(hex: string): number | null {
  if (!HEX_RE.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  switch (max) {
    case r:
      h = ((g - b) / d) % 6;
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  h *= 60;
  if (h < 0) h += 360;
  return h;
}

function pickFromWheel(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): string {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const radius = rect.width / 2;
  if (dist < radius * 0.28) {
    return '#808080';
  }
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  angle = (angle + 360) % 360;
  const sat = clamp((dist / radius) * 100, 45, 100);
  return hslToHex(angle, sat, 55);
}

export function ColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (hex: string | null) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState(value ?? '');
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!open) setHexDraft(value ?? '');
  }, [value, open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const swatchStyle: CSSProperties = value
    ? { background: value }
    : { background: 'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)' };

  const applyHex = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange(null);
      return;
    }
    const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    if (HEX_RE.test(normalized)) {
      onChange(normalized.toLowerCase());
      setHexDraft(normalized.toLowerCase());
    }
  };

  const onWheelPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const el = wheelRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    setDragging(true);
    const rect = el.getBoundingClientRect();
    const hex = pickFromWheel(e.clientX, e.clientY, rect);
    setHexDraft(hex);
    onChange(hex);
  };

  const onWheelMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const el = wheelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const hex = pickFromWheel(e.clientX, e.clientY, rect);
    setHexDraft(hex);
    onChange(hex);
  };

  const onWheelUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onSwatchKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen((v) => !v);
    }
  };

  const hue = value ? hexToHue(value) : null;

  return (
    <div className="color-picker" ref={rootRef}>
      <button
        type="button"
        className="color-swatch"
        style={swatchStyle}
        disabled={disabled}
        aria-label="Column color"
        aria-expanded={open}
        aria-controls={id}
        title={value ?? 'Set column color'}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onSwatchKey}
      />
      {open ? (
        <div className="color-picker-popover" id={id} role="dialog" aria-label="Pick color">
          <div
            ref={wheelRef}
            className="color-wheel"
            style={
              hue != null
                ? ({ ['--picker-hue' as string]: `${hue}deg` } as CSSProperties)
                : undefined
            }
            onPointerDown={onWheelPointer}
            onPointerMove={onWheelMove}
            onPointerUp={onWheelUp}
            onPointerCancel={onWheelUp}
          >
            <span className="color-wheel-center" aria-hidden />
          </div>
          <label className="color-hex-field">
            <span>Hex</span>
            <input
              value={hexDraft}
              placeholder="#7aa2f7"
              spellCheck={false}
              maxLength={7}
              onChange={(e) => setHexDraft(e.target.value)}
              onBlur={() => applyHex(hexDraft)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyHex(hexDraft);
                }
              }}
            />
          </label>
          <div className="color-picker-actions">
            <button
              type="button"
              className="btn btn-ghost btn-tiny"
              onClick={() => {
                onChange(null);
                setHexDraft('');
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-tiny"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
