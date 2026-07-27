import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useCard } from "@/hooks/use-card";

const MIN_WIDTH = 360;
const MAX_WIDTH = 90;
const DEFAULT_WIDTH = 50;
const HANDLE_WIDTH = 6;

export function CardPanel() {
  const { isOpen, content, url, close } = useCard();
  const [widthPct, setWidthPct] = useState(() => {
    try { return JSON.parse(localStorage.getItem('card-width') || String(DEFAULT_WIDTH)); }
    catch { return DEFAULT_WIDTH; }
  });
  const dragging = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('card-width', JSON.stringify(widthPct));
  }, [widthPct]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) close();
      if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
        setWidthPct(prev => Math.min(100, Math.max(0, prev + 1)));
        e.preventDefault();
      }
      if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
        setWidthPct(prev => Math.min(100, Math.max(0, prev - 1)));
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, close, setWidthPct]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const startX = e.clientX;
    const startPct = widthPct;

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const vw = window.innerWidth;
      const deltaPx = startX - ev.clientX;
      const deltaPct = (deltaPx / vw) * 100;
      const newPct = Math.max(100 - MAX_WIDTH, Math.min(100 - MIN_WIDTH / vw * 100, startPct + deltaPct));
      setWidthPct(newPct);
    };

    const onUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [widthPct]);

  const setCardPos = useCallback((val: number) => {
    setWidthPct(val);
  }, []);

  return (
    <>
    <div
      ref={panelRef}
      className={`fixed top-0 right-0 h-full z-50 bg-card border-l border-border shadow-2xl ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      style={{ left: `${100 - widthPct}%` }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 z-10 cursor-ew-resize bg-transparent hover:bg-primary/20 transition-colors"
        style={{ width: HANDLE_WIDTH, marginLeft: -HANDLE_WIDTH / 2 }}
        onMouseDown={handleMouseDown}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-border group-hover:bg-primary/40" />
      </div>

      <div className="absolute top-0 left-0 z-10">
        <button
          onClick={close}
          className="w-9 h-9 flex items-center justify-center rounded-none bg-card border-0 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer text-lg leading-none"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {url ? (
        <iframe
          src={url + (url.indexOf('?') === -1 ? '?' : '&') + 'embed=1&_t=' + Date.now()}
          className="h-full w-full border-none"
          title="Card"
          style={{ backgroundColor: '#0d1117' }}
        />
      ) : (
        <div className="h-full overflow-y-auto p-4 pt-12">
          {content}
        </div>
      )}
    </div>

    <div className="fixed bottom-11 right-0 h-4 z-[60] cursor-pointer select-none" style={{ left: `${100 - widthPct}%` }}>
      <input
        type="range"
        min={0}
        max={100}
        value={widthPct}
        onChange={(e) => setCardPos(Number(e.target.value))}
        className="absolute inset-0 w-full m-0 p-0 opacity-0 cursor-pointer z-[2]"
      />
      <div className="absolute inset-[4px_0] z-[1] pointer-events-none">
        <div
          className="absolute top-1/2 w-[18px] h-[18px] rounded-full bg-primary border-2 border-white shadow-[0_0_8px_rgba(88,166,255,0.5)] z-[3]"
          style={{ left: '0%', transform: 'translate(-50%, -50%)' }}
        />
      </div>
    </div>
    </>
  );
}
