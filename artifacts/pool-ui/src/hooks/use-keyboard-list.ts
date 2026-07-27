import { useRef, useCallback } from "react";

export function useKeyboardList<T>({
  items,
  onEnter,
}: {
  items: T[];
  onEnter: (item: T) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const getFocusable = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.querySelectorAll<HTMLElement>("[data-list-item]"));
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const els = getFocusable();
    if (els.length === 0) return;
    const cur = els.findIndex(el => el === document.activeElement);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      els[(cur + 1) % els.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      els[(cur - 1 + els.length) % els.length]?.focus();
    } else if (e.key === "Enter" && cur >= 0 && cur < items.length) {
      onEnter(items[cur]);
    }
  }, [items, onEnter, getFocusable]);

  return { containerRef, handleKeyDown };
}
