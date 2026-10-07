import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Box, ArrowRightLeft, Terminal, Cpu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardPanel } from "@/components/card-panel";
import { useCard } from "@/hooks/use-card";
import { useEffect, useState, useRef } from "react";
import { useHealthCheck } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sidebar-collapsed') || 'false'); }
    catch { return false; }
  });
  const { data: health } = useHealthCheck();
  const { isOpen: isCardOpen, close: closeCard } = useCard();
  const navRef = useRef<HTMLDivElement>(null);
  const focusedIdxRef = useRef(-1);
  const isAdmin = location === '/admin';

  const focusNavItem = (index: number = 0) => {
    requestAnimationFrame(() => {
      const links = navRef.current?.querySelectorAll<HTMLAnchorElement>('a');
      links?.[index]?.focus();
    });
  };

  const focusActiveNavItem = () => {
    const idx = navItems.findIndex(
      item => location === item.href || (location.startsWith(item.href) && item.href !== "/")
    );
    focusNavItem(idx >= 0 ? idx : 0);
  };

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    focusActiveNavItem();
  }, [location]);

  useEffect(() => {
    const timer = setTimeout(focusActiveNavItem, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isCardOpen && !isAdmin) {
        const savedEl = document.activeElement as HTMLElement;
        setIsCollapsed(prev => !prev);
        requestAnimationFrame(() => {
          if (navRef.current?.contains(savedEl)) {
            savedEl.focus();
          }
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isCardOpen, isAdmin]);

  const navItems = [
    { href: "/", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { href: "/miners", label: "Miners", icon: <Users className="w-4 h-4" /> },
    { href: "/blocks", label: "Blocks", icon: <Box className="w-4 h-4" /> },
    { href: "/payouts", label: "Payouts", icon: <ArrowRightLeft className="w-4 h-4" /> },
    { href: "/start", label: "Getting Started", icon: <Terminal className="w-4 h-4" /> },
  ];

  const getNavLinkIndex = (): number => {
    if (!navRef.current) return -1;
    const links = navRef.current.querySelectorAll('a');
    return Array.from(links).findIndex(el => el === document.activeElement);
  };

  const focusRightPanel = () => {
    setTimeout(() => {
      const first = document.querySelector<HTMLElement>('main [data-list-item]');
      first?.focus();
    }, 50);
  };

  const handleNavKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const links = e.currentTarget.querySelectorAll('a');
      const currentIdx = getNavLinkIndex();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const nextIdx = (currentIdx + dir + links.length) % links.length;
      focusedIdxRef.current = nextIdx;
      (links[nextIdx] as HTMLAnchorElement)?.focus();
    }
    if (e.key === 'Enter') {
      const active = document.activeElement;
      if (active?.tagName === 'A' && navRef.current?.contains(active)) {
        const href = active.getAttribute('href');
        if (href === location) {
          e.preventDefault();
          const first = document.querySelector<HTMLElement>('main [data-list-item]');
          first?.focus();
        }
      }
    }
  };

  const saveFocusedIndex = () => {
    const idx = getNavLinkIndex();
    if (idx >= 0) focusedIdxRef.current = idx;
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card border-r border-border">
      <div className={`p-6 border-b border-border flex items-center gap-3 ${isCollapsed ? 'justify-center p-4' : ''}`}>
        <div className="bg-primary/10 p-2 border border-primary/30 text-primary shrink-0">
          <Cpu className="w-5 h-5" />
        </div>
        {!isCollapsed && (
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight text-foreground font-mono">POOL</h1>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 ${health ? 'bg-primary' : 'bg-muted-foreground animate-pulse'} rounded-none shadow-[0_0_8px_hsl(var(--primary))]`} />
              <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{health ? 'Network Online' : 'Connecting...'}</span>
            </div>
          </div>
        )}
      </div>
      {isCollapsed && health && (
        <div className="flex justify-center py-3 border-b border-border">
          <div className="w-2 h-2 bg-primary rounded-none shadow-[0_0_8px_hsl(var(--primary))]" />
        </div>
      )}
      <div
        ref={navRef}
        className="flex-1 py-6 px-4 space-y-2 overflow-y-auto"
        onKeyDown={handleNavKeyDown}
        onMouseOver={saveFocusedIndex}
      >
        {navItems.map((item) => {
          const isActive = location === item.href || (location.startsWith(item.href) && item.href !== "/");
          const link = (
            <Link key={item.href} href={item.href} className={`sidebar-link block focus-visible:outline-none ${isActive ? 'sidebar-link-active' : ''}`}>
              <div onClick={() => { closeCard(); focusRightPanel(); }} className={`flex items-center gap-3 px-4 py-3 transition-colors font-mono text-sm ${isCollapsed ? 'justify-center px-0 mx-2' : ''}`}>
                {item.icon}
                {!isCollapsed && item.label}
              </div>
            </Link>
          );
          if (isCollapsed) {
            return link;
          }
          return link;
        })}
      </div>
      <div className="p-4 border-t border-border flex items-center gap-2">
        {!isCollapsed && (
          <div className="text-xs text-muted-foreground font-mono">v1.0.31</div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={`w-7 h-7 text-muted-foreground hover:text-foreground shrink-0 ${isCollapsed ? 'mx-auto' : 'ml-auto'}`}
          onClick={() => setIsCollapsed(prev => !prev)}
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );

  const isEmbedded = typeof window !== 'undefined' && window.location.search.includes('embed=1');

  return (
    <div className="min-h-screen flex bg-background dark text-foreground">
      {!isEmbedded && !isAdmin && (
        <>
      {/* Desktop Sidebar */}
      <aside className={`hidden md:block ${isCollapsed ? 'w-16' : 'w-64'} h-screen sticky top-0 transition-[width] duration-200`}>
        <SidebarContent />
      </aside>
      </>
      )}

      <main className="flex-1 flex flex-col min-w-0 max-w-full">
        <div className={`flex-1 ${isAdmin ? '' : 'p-4 md:p-8 pt-20 md:pt-8 w-full max-w-7xl mx-auto'}`}>
          {children}
        </div>
      </main>

      {!isEmbedded && !isAdmin && <CardPanel />}
    </div>
  );
}
