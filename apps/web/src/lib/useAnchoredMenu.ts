import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Fixed-position popover anchored under a trigger button, rendered via a
 * portal so table overflow containers can't clip it. Closes on outside click
 * and Escape. Scrolling (page or any container) repositions the menu to
 * follow its trigger instead of closing it — focus-induced auto-scrolls of
 * the table's horizontal overflow would otherwise close menus instantly.
 */
export function useAnchoredMenu(menuWidth: number) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const reposition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(
      8,
      Math.min(rect.left + rect.width / 2 - menuWidth / 2, window.innerWidth - menuWidth - 8),
    );
    const height = menuRef.current?.offsetHeight ?? 0;
    const maxTop = window.innerHeight - height - 8;
    setPos({ top: Math.max(8, Math.min(rect.bottom + 6, maxTop)), left });
  }, [menuWidth]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    // Second pass once the menu has rendered so its measured height keeps it
    // fully inside the viewport (avoids browser auto-scrolling to it).
    const raf = requestAnimationFrame(reposition);
    return () => cancelAnimationFrame(raf);
  }, [open, reposition]);

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
      reposition();
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, reposition]);

  return { triggerRef, menuRef, open, setOpen, pos };
}
