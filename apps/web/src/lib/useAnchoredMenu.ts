import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Fixed-position popover anchored under a trigger button, rendered via a
 * portal so table overflow containers can't clip it. Closes on outside
 * click, Escape, and any outside scroll (so the menu never drifts away
 * from its anchor).
 */
export function useAnchoredMenu(menuWidth: number) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(
      8,
      Math.min(rect.left + rect.width / 2 - menuWidth / 2, window.innerWidth - menuWidth - 8),
    );
    setPos({ top: rect.bottom + 6, left });
  }, [open, menuWidth]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  return { triggerRef, menuRef, open, setOpen, pos };
}
