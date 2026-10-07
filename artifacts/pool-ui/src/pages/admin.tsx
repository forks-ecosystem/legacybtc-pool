import { useState, useEffect, type FormEvent } from "react";
import { PanelLeftClose, PanelLeftOpen, LogOut, Save, Loader2 } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useKeyboardList } from "@/hooks/use-keyboard-list";

const API = "/api/admin";
type ConfigData = Record<string, string>;
type ServiceState = Record<string, { name: string; status: string; hint?: string }>;
type WalletBalance = { label: string; address: string; balance: number };
type BalancesData = { total?: number; spendable?: number; addresses: Record<string, WalletBalance> };

const SECTIONS: Record<string, { label: string; icon: string; desc: string; fields: { key: string; label: string; desc: string; type?: string; placeholder?: string }[] }> = {
  general: {
    label: "General", icon: "⚙️", desc: "Pool API server settings",
    fields: [
      { key: "PORT", label: "HTTP Port", desc: "Pool web interface port", placeholder: "3001" },
      { key: "STRATUM_PPLNS_PORT", label: "PPLNS Port", desc: "Stratum PPLNS mining port", placeholder: "3333" },
      { key: "STRATUM_SOLO_PORT", label: "SOLO Port", desc: "Stratum SOLO mining port", placeholder: "3331" },
    ],
  },
  database: {
    label: "Database", icon: "🗄️", desc: "PostgreSQL connection",
    fields: [
      { key: "DATABASE_URL", label: "Connection String", desc: "postgresql://user:pass@host:port/database", placeholder: "postgresql://btcpool:btcpass123@127.0.0.1:5433/btc_pool" },
    ],
  },
  wallet: {
    label: "Wallet", icon: "💼", desc: "Development wallet and fees",
    fields: [
      { key: "DEV_FEE", label: "Dev Fee", desc: "Fee fraction (0.05 = 5%)", placeholder: "0.05" },
      { key: "DEV_WALLET", label: "Wallet Address", desc: "Dev wallet address for mining rewards", placeholder: "LfSbSV7..." },
      { key: "DEV_FEE_ADDRESS", label: "Fee Address", desc: "Address receiving dev fees", placeholder: "LTFN539..." },
    ],
  },
  node: {
    label: "Node RPC", icon: "🔗", desc: "LegacyCoin node JSON-RPC connection",
    fields: [
      { key: "NODE_RPC_HOST", label: "Host", desc: "Node RPC IP or hostname", placeholder: "127.0.0.1" },
      { key: "NODE_RPC_PORT", label: "Port", desc: "Node RPC port", placeholder: "19556" },
      { key: "NODE_RPC_USER", label: "Username", desc: "RPC auth user", placeholder: "coin" },
      { key: "NODE_RPC_PASS", label: "Password", desc: "RPC auth password", type: "password", placeholder: "coin" },
      { key: "NODE_RPC_COOKIE", label: "Cookie Path", desc: "Path to .cookie file", placeholder: "/home/coin/.legacycoin/.cookie" },
    ],
  },
  explorer: {
    label: "Explorer", icon: "🔍", desc: "Block explorer",
    fields: [],
  },
};

const SIDEBAR_ITEMS = [
  { id: "general", label: "General", icon: "⚙️" },
  { id: "database", label: "Database", icon: "🗄️" },
  { id: "wallet", label: "Wallet", icon: "💼" },
  { id: "node", label: "Node RPC", icon: "🔗" },
  { id: "explorer", label: "Explorer", icon: "🔍" },
  { id: "services", label: "Services", icon: "▶️" },
];

function Admin() {
  const [mode, setMode] = useState<"loading" | "setup" | "login" | "dashboard">("loading");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [token, setToken] = useState(() => sessionStorage.getItem("admin_token"));
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [edits, setEdits] = useState<ConfigData>({});
  const [services, setServices] = useState<ServiceState | null>(null);
  const [balances, setBalances] = useState<BalancesData | null>(null);
  const [section, setSection] = useState(() => {
    try { return localStorage.getItem('admin-section') || "general"; }
    catch { return "general"; }
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [serviceBusy, setServiceBusy] = useState<{ key: string; action: string } | null>(null);
  const [serviceMsg, setServiceMsg] = useState<{ key: string; text: string; error: boolean } | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('admin-sidebar-collapsed') || 'false'); }
    catch { return false; }
  });

  useEffect(() => {
    localStorage.setItem('admin-sidebar-collapsed', JSON.stringify(collapsed));
  }, [collapsed]);

  useEffect(() => {
    localStorage.setItem('admin-section', section);
  }, [section]);

  useEffect(() => {
    if (mode !== 'dashboard') return;
    const id = window.setTimeout(() => {
      const els = menuRef.current?.querySelectorAll<HTMLButtonElement>('[data-list-item]');
      if (!els || els.length === 0) return;
      const idx = SIDEBAR_ITEMS.findIndex((i) => i.id === section);
      els[idx >= 0 ? idx : 0]?.focus();
    }, 60);
    return () => window.clearTimeout(id);
  }, [mode, section]);

  useEffect(() => {
    if (mode !== "dashboard") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCollapsed((c) => !c);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  const { containerRef: menuRef, handleKeyDown: menuKeys } = useKeyboardList({
    items: SIDEBAR_ITEMS,
    onEnter: (it) => goSection(it.id),
  });

  const headers = (t?: string) => ({ Authorization: `Bearer ${t ?? token ?? ""}` });

  const fetchDashboard = (t: string) => {
    fetch(`${API}/config`, { headers: headers(t) })
      .then((r) => {
        if (r.ok) return r.json().then((d) => { setConfig(d); setEdits(d); setMode("dashboard"); });
        sessionStorage.removeItem("admin_token"); setToken(null); setMode("login");
      })
      .catch(() => setMode("login"));
  };

  const fetchServices = () => {
    fetch(`${API}/services`, { headers: headers() })
      .then((r) => r.ok && r.json().then(setServices))
      .catch(() => {});
  };

  const fetchBalances = () => {
    fetch(`${API}/wallet-balances`, { headers: headers() })
      .then((r) => r.ok && r.json().then(setBalances))
      .catch(() => {});
  };

  useEffect(() => {
    fetch(`${API}/status`)
      .then((r) => r.json())
      .then((data) => {
        if (data.configured) {
          if (token) fetchDashboard(token);
          else setMode("login");
        } else {
          setMode("setup");
        }
      })
      .catch(() => setMode("setup"));
  }, [token]);

  useEffect(() => {
    if (mode === "dashboard" && section === "services" && !services) fetchServices();
  }, [mode, section, services]);

  useEffect(() => {
    if (mode === "dashboard" && section === "wallet" && !balances) fetchBalances();
  }, [mode, section, balances, config]);

  const handleSetup = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 3) { setError("Password must be at least 3 characters"); return; }
    try {
      const r = await fetch(`${API}/setup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, password }) });
      const data = await r.json();
      if (r.ok) { sessionStorage.setItem("admin_token", data.token); setToken(data.token); }
      else setError(data.error || "Setup failed");
    } catch { setError("Network error"); }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const r = await fetch(`${API}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, password }) });
      const data = await r.json();
      if (r.ok) { sessionStorage.setItem("admin_token", data.token); setToken(data.token); }
      else setError(data.error || "Invalid credentials");
    } catch { setError("Network error"); }
  };

  const handleLogout = async () => {
    await fetch(`${API}/logout`, { method: "POST", headers: headers() });
    sessionStorage.removeItem("admin_token");
    setToken(null); setConfig(null); setServices(null); setMode("login"); setPassword("");
  };

  const waitForRestart = async (): Promise<boolean> => {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const r = await fetch(`${API}/status`, { cache: "no-store" });
        if (r.ok) return true;
      } catch {
        // контейнер пересоздаётся — ждём
      }
    }
    return false;
  };

  const handleSave = async () => {
    setSaving(true); setSaveMsg("");
    try {
      const r = await fetch(`${API}/config`, { method: "POST", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify(edits) });
      const data = await r.json();
      if (!data.ok) {
        setSaveMsg(data.error || "Error");
        setSaving(false);
        setTimeout(() => setSaveMsg(""), 3000);
        return;
      }
      if (data.reload) {
        setSaveMsg("Restarting…");
        if (await waitForRestart()) {
          setSaveMsg("Saved");
          if (token) fetchDashboard(token); else setConfig({ ...edits });
        } else {
          setSaveMsg("Saved, restart pending");
        }
      } else {
        setSaveMsg("Saved");
        setConfig({ ...edits });
      }
    } catch { setSaveMsg("Network error"); }
    setSaving(false);
    setTimeout(() => setSaveMsg(""), 3000);
  };

  const serviceAction = async (name: string, action: string) => {
    setServiceBusy({ key: name, action });
    setServiceMsg(null);
    try {
      const r = await fetch(`${API}/services/${name}/${action}`, { method: "POST", headers: headers() });
      const data = r.ok ? null : await r.json().catch(() => null);
      if (!r.ok) {
        setServiceMsg({ key: name, text: data?.error || `HTTP ${r.status}: ${action} failed`, error: true });
        return;
      }
      await new Promise((res) => setTimeout(res, 800));
      fetchServices();
      setServiceMsg({ key: name, text: action === "stop" ? "Stopped" : action === "restart" ? "Restarted" : "Started", error: false });
    } catch (err) {
      setServiceMsg({ key: name, text: err instanceof Error ? err.message : String(err), error: true });
    } finally {
      setServiceBusy(null);
    }
  };

  const goSection = (id: string) => {
    setSection(id);
    setSaveMsg("");
    if (id === "services") fetchServices();
  };

  const buildUrl = (proto: string, host: string, port?: string) =>
    host ? `${proto}://${host}${port ? `:${port}` : ""}` : "";

  if (mode === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dark text-foreground">
      {mode === "setup" && (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <h1 className="text-2xl font-mono font-bold mb-2 text-center">Admin Setup</h1>
            <p className="text-sm text-muted-foreground mb-8 text-center">Create your admin credentials</p>
            <form onSubmit={handleSetup} className="space-y-5">
              <div>
                <label className="block text-sm font-mono mb-1.5">Login</label>
                <input autoFocus value={login} onChange={(e) => setLogin(e.target.value)} className="w-full px-3 py-2.5 bg-muted border border-border rounded font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-shadow" />
              </div>
              <div>
                <label className="block text-sm font-mono mb-1.5">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2.5 bg-muted border border-border rounded font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-shadow" />
              </div>
              <div>
                <label className="block text-sm font-mono mb-1.5">Confirm Password</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full px-3 py-2.5 bg-muted border border-border rounded font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-shadow" />
              </div>
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              <div className="welcome-divider">
                <span className="line"></span>
                <span className="welcome-text animate">
                  <span className="rocket">🚀</span>
                  <span className="glow">On Your Way !!!</span>
                  <span className="rocket">✨</span>
                </span>
                <span className="line"></span>
              </div>
              <button type="submit" className="w-full py-2.5 bg-primary text-primary-foreground font-mono text-sm rounded hover:opacity-90 cursor-pointer">Create Admin</button>
            </form>
          </div>
        </div>
      )}

      {mode === "login" && (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-mono font-bold mb-6 text-center">Admin Login</h1>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-mono mb-1.5">Login</label>
                <input autoFocus value={login} onChange={(e) => setLogin(e.target.value)} className="w-full px-3 py-2.5 bg-muted border border-border rounded font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-shadow" />
              </div>
              <div>
                <label className="block text-sm font-mono mb-1.5">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2.5 bg-muted border border-border rounded font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-shadow" />
              </div>
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              <button type="submit" className="w-full py-2.5 bg-primary text-primary-foreground font-mono text-sm rounded hover:opacity-90 cursor-pointer">Login</button>
            </form>
          </div>
        </div>
      )}

      {mode === "dashboard" && (
        <div className="flex h-screen overflow-hidden">
           {/* Sidebar */}
           <aside className={`${collapsed ? 'w-16' : 'w-56'} shrink-0 h-full bg-card border-r border-border flex flex-col transition-[width] duration-200`}>
             <div className={`p-3 border-b border-border flex items-center gap-2 ${collapsed ? 'justify-center' : 'justify-between'}`}>
               {!collapsed && <h2 className="text-sm font-mono font-bold tracking-tight">Admin Panel</h2>}
               <button onClick={() => setCollapsed((c) => !c)} title={collapsed ? "Expand" : "Collapse"}
                 className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground rounded hover:bg-muted cursor-pointer shrink-0">
                 {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
               </button>
             </div>
             <nav ref={menuRef} onKeyDown={menuKeys} className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
               {SIDEBAR_ITEMS.map((item) => {
                 const btn = (
                   <button key={item.id} onClick={() => goSection(item.id)} data-list-item tabIndex={0}
                     className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm font-mono text-left transition-colors cursor-pointer focus:outline-none focus-visible:bg-[linear-gradient(to_left,#358_1%,#111)] ${
                       collapsed ? 'justify-center px-0' : ''
                     } ${
                       section === item.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                     }`}>
                     <span className="text-base">{item.icon}</span>
                     {!collapsed && <span>{item.label}</span>}
                   </button>
                 );
                 return collapsed ? (
                   <Tooltip key={item.id}>
                     <TooltipTrigger asChild>{btn}</TooltipTrigger>
                     <TooltipContent side="right" sideOffset={8}>{item.label}</TooltipContent>
                   </Tooltip>
                 ) : btn;
               })}
             </nav>
             <div className="p-3 border-t border-border space-y-2">
               {!collapsed && (
                 <div className="text-xs font-mono text-muted-foreground">
                   {services ? Object.entries(services).map(([k, s]) => (
                     <div key={k} className="flex items-center gap-2 py-0.5">
                       <span className={`w-1.5 h-1.5 rounded-full ${s.status === "active" ? "bg-green-500" : "bg-red-500"}`} />
                       <span className="truncate">{s.name.replace(/^l?btc-?/, "")}</span>
                     </div>
                   )) : <div className="py-0.5">Loading...</div>}
                 </div>
               )}
               <button onClick={handleLogout} title="Logout"
                 className={`w-full py-1.5 flex items-center justify-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground border border-border rounded hover:bg-muted cursor-pointer ${collapsed ? '' : 'justify-center'}`}>
                 <LogOut className="w-3.5 h-3.5" />
                 {!collapsed && <span>Logout</span>}
               </button>
             </div>
           </aside>

           {/* Content */}
           <main className="flex-1 h-full p-6 overflow-y-auto">
             {section !== "services" && SECTIONS[section] && (
               <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xl">{SECTIONS[section].icon}</span>
                  <h2 className="text-xl font-mono font-bold">{SECTIONS[section].label}</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-6 font-mono">{SECTIONS[section].desc}</p>

                {/* Protocol / URL / Port summary */}
                {section === "node" && config && (
                  <div className="p-3 mb-6 bg-[#123] border border-border rounded font-mono text-xs space-y-1">
                    <div className="flex items-baseline gap-3">
                      <span className="w-28 shrink-0 text-right text-muted-foreground">Protocol:</span>
                      <span>http</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="w-28 shrink-0 text-right text-muted-foreground">RPC URL:</span>
                      <span style={{ userSelect: "all" }}>{buildUrl("http", config.NODE_RPC_HOST, config.NODE_RPC_PORT) || "—"}</span>
                    </div>
                  </div>
                )}
                {section === "general" && config && (
                  <div className="p-3 mb-6 bg-[#123] border border-border rounded font-mono text-xs space-y-1">
                    <div className="flex items-baseline gap-3">
                      <span className="w-28 shrink-0 text-right text-muted-foreground">Protocol:</span>
                      <span>http</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="w-28 shrink-0 text-right text-muted-foreground">URL:</span>
                      <span>{buildUrl("http", "localhost", config.PORT) || "—"}</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="w-28 shrink-0 text-right text-muted-foreground">Port:</span>
                      <span>{config.PORT || "—"}</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="w-28 shrink-0 text-right text-muted-foreground">PPLNS:</span>
                      <span>{config.STRATUM_PPLNS_PORT || "3333"}</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="w-28 shrink-0 text-right text-muted-foreground">SOLO:</span>
                      <span>{config.STRATUM_SOLO_PORT || "3331"}</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="w-28 shrink-0 text-right text-muted-foreground">Run:</span>
                      <span>docker</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="w-28 shrink-0 text-right text-muted-foreground">Path:</span>
                      <span style={{ userSelect: "all" }}>/app/legacybtc-pool</span>
                    </div>
                  </div>
                )}
                {section === "wallet" && config && (
                  <div className="p-3 mb-6 bg-[#123] border border-border rounded font-mono text-xs space-y-1">
                    <div className="flex items-baseline gap-3">
                      <span className="w-28 shrink-0 text-right text-muted-foreground">Dev Fee:</span>
                      <span>{(() => {
                        const f = Number(config.DEV_FEE);
                        if (!config.DEV_FEE || Number.isNaN(f)) return "—";
                        return `${f < 1 ? f * 100 : f}%`;
                      })()}</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="w-28 shrink-0 text-right text-muted-foreground">Wallet Address:</span>
                      <span style={{ userSelect: "all" }}>{config.DEV_WALLET || "—"}</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="w-28 shrink-0 text-right text-muted-foreground">Fee Address:</span>
                      <span style={{ userSelect: "all" }}>{config.DEV_FEE_ADDRESS || "—"}</span>
                    </div>
                  </div>
                )}
                {section === "explorer" && config && (
                  <div className="p-3 mb-6 bg-[#123] border border-border rounded font-mono text-xs space-y-1">
                    <div className="flex items-baseline gap-3">
                      <span className="w-28 shrink-0 text-right text-muted-foreground">Protocol:</span>
                      <span>https</span>
                    </div>
                    <div className="mt-1.5">
                      <div className="mb-1"><span className="text-muted-foreground">Explorer URL</span></div>
                      <input
                        type="text"
                        value={edits["URL_EXPLORER"] ?? ""}
                        onChange={(e) => setEdits({ ...edits, URL_EXPLORER: e.target.value })}
                        placeholder="https://explorer.example.com/search?q="
                        className="w-full px-2.5 py-1.5 bg-background border border-border rounded font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary transition-shadow"
                      />
                      <p className="text-muted-foreground mt-1">Block explorer base URL with ?q= parameter</p>
                    </div>
                  </div>
                )}
                {section === "database" && config && (() => {
                  const m = config.DATABASE_URL?.match(/^(postgresql|postgres):\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
                  return (
                    <div className="p-3 mb-6 bg-[#123] border border-border rounded font-mono text-xs space-y-1">
                      <div className="flex items-baseline gap-3">
                        <span className="w-28 shrink-0 text-right text-muted-foreground">Protocol:</span>
                        <span>{m?.[1] || "—"}</span>
                      </div>
                      <div className="flex items-baseline gap-3">
                        <span className="w-28 shrink-0 text-right text-muted-foreground">Host:</span>
                        <span>{m?.[4] || "—"}</span>
                      </div>
                      <div className="flex items-baseline gap-3">
                        <span className="w-28 shrink-0 text-right text-muted-foreground">Port:</span>
                        <span>{m?.[5] || "—"}</span>
                      </div>
                      <div className="flex items-baseline gap-3">
                        <span className="w-28 shrink-0 text-right text-muted-foreground">Database:</span>
                        <span>{m?.[6] || "—"}</span>
                      </div>
                      <div className="flex items-baseline gap-3">
                        <span className="w-28 shrink-0 text-right text-muted-foreground">User:</span>
                        <span>{m?.[2] || "—"}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Form fields */}
                <div className="space-y-5 ml-[10px]">
                  {SECTIONS[section].fields.map((f) => (
                    <div key={f.key}>
                      {section === "wallet" && (f.key === "DEV_WALLET" || f.key === "DEV_FEE_ADDRESS") && (
                        <div className="text-xs font-mono text-primary mb-1.5">
                          Balance: {(() => {
                            const addr = f.key === "DEV_WALLET" ? config?.DEV_WALLET : config?.DEV_FEE_ADDRESS;
                            const b = balances?.addresses?.[addr ?? ""]?.balance;
                            return b == null ? "—" : Number(b).toLocaleString("en-US", { maximumFractionDigits: 8 });
                          })()}
                        </div>
                      )}
                      <div className="grid grid-cols-[minmax(10rem,14rem)_1fr] gap-x-4 items-center">
                        <div>
                          <label className="block text-sm font-mono">{f.label}</label>
                          <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
                        </div>
                        <input
                          type={f.type || "text"}
                          value={edits[f.key] ?? ""}
                          onChange={(e) => setEdits({ ...edits, [f.key]: e.target.value })}
                          placeholder={f.placeholder}
                          className="w-full px-3 py-2 bg-muted border border-border rounded font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-shadow"
                        />
                      </div>
                    </div>
                  ))}

                  <div className="grid grid-cols-[minmax(10rem,14rem)_1fr] gap-x-4 items-center">
                    <div />
                    <div className="flex items-center gap-3">
                      <button onClick={handleSave} disabled={saving} title="Save Changes" aria-label="Save Changes" className="w-9 h-9 flex items-center justify-center bg-green-600 text-white font-mono text-sm rounded hover:bg-green-700 disabled:opacity-50 cursor-pointer">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}</button>
                      {saveMsg && <span className={`text-sm font-mono ${saveMsg === "Saved" ? "text-green-500" : saveMsg.startsWith("Restarting") || saveMsg.startsWith("Saved,") ? "text-amber-500" : "text-red-500"}`}>{saveMsg}</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {section === "services" && (
              <div>
                <h2 className="text-xl font-mono font-bold mb-1">Services</h2>
                <p className="text-sm text-muted-foreground mb-6 font-mono">Manage system services</p>
                <div className="space-y-3">
                  {services ? Object.entries(services).map(([key, svc]) => (
                    <div key={key} className="p-5 bg-muted border border-border rounded font-mono text-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold mb-0.5">{svc.name}</div>
                          {svc.hint && <div className="text-[11px] text-muted-foreground mb-1">{svc.hint}</div>}
                          <div className="flex items-center gap-2 text-xs">
                            <span className={`w-2 h-2 rounded-full ${svc.status === "active" ? "bg-green-500" : "bg-red-500"}`} />
                            <span className={svc.status === "active" ? "text-green-500" : "text-red-500"}>{svc.status}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 items-center">
                          {(() => {
                            const busy = serviceBusy?.key === key;
                            const spin = (a: string) => busy && serviceBusy?.action === a;
                            return (
                              <>
                                {svc.status !== "active" && <button onClick={() => serviceAction(key, "start")} disabled={busy} className="px-4 py-1.5 bg-primary text-primary-foreground rounded text-xs hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5">{spin("start") ? <Loader2 className="w-3 h-3 animate-spin" /> : "Start"}</button>}
                                {svc.status === "active" && <button onClick={() => serviceAction(key, "stop")} disabled={busy} className="px-4 py-1.5 bg-destructive text-destructive-foreground rounded text-xs hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5">{spin("stop") ? <Loader2 className="w-3 h-3 animate-spin" /> : "Stop"}</button>}
                                <button onClick={() => serviceAction(key, "restart")} disabled={busy} className="px-4 py-1.5 bg-muted-foreground/20 text-foreground rounded text-xs hover:bg-muted-foreground/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5">{spin("restart") ? <Loader2 className="w-3 h-3 animate-spin" /> : "Restart"}</button>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      {serviceMsg?.key === key && (
                        <div className={`mt-3 text-xs font-mono ${serviceMsg.error ? "text-red-500" : "text-green-500"}`}>
                          {serviceMsg.error ? `Error: ${serviceMsg.text}` : serviceMsg.text}
                        </div>
                      )}
                    </div>
                  )) : (
                    <div className="p-5 bg-muted border border-border rounded font-mono text-sm text-muted-foreground">Loading...</div>
                  )}
                </div>

                <div className="mt-10 font-mono text-xs space-y-3">
                  <p className="text-muted-foreground">Services</p>
                  <a href="https://github.com/forks-ecosystem/legacycore" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all block">https://github.com/forks-ecosystem/legacycore</a>
                  <div className="space-y-2 text-muted-foreground">
                    <p>
                      <span className="text-foreground">Node installer — _git_supervisor.sh</span>
                      <br />Builds <span className="text-foreground">legacycoind</span> and <span className="text-foreground">legacycoin-cli</span> from forks-ecosystem/legacycore. Required by the pool, explorer and agent.
                    </p>
                    <p>
                      <span className="text-foreground">Agent installer — _git_legacycore.sh</span>
                      <br />Builds <span className="text-foreground">legacycoreagent</span>. Extends the pool with agent-side job, wallet and balance automation.
                    </p>
                    <p>
                      <span className="text-foreground">Supervisor — forks-life-supervisor</span>
                      <br />Watches the node, explorer and pool units and restarts them on failure. Extends the functionality of the whole stack.
                    </p>
                    <p>
                      <span className="text-foreground">Explorer installer (optional) — _git_legacycoin-explorer.sh</span>
                      <br />Builds the <span className="text-foreground">explorer</span> block explorer service. Not required for mining or payouts.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

export default Admin;
