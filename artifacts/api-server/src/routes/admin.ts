import { Router, type IRouter, type Request, type Response } from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { isConfigured, setupAdmin, verifyLogin, verifySession, logout } from "../lib/admin-auth";
import { rpcCall } from "../lib/rpc";

const execAsync = promisify(execFile);
const ENV_PATH = path.resolve(process.cwd(), "config", "pool.env");
// Хостовый legacybtc-pool-reload.path следит за этим файлом и пересоздаёт
// контейнер: переменные окружения читаются только при старте контейнера.
const ENV_RELOAD_PATH = path.join(path.dirname(ENV_PATH), ".reload-app");

const router: IRouter = Router();

function authMiddleware(req: Request, res: Response, next: () => void): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  verifySession(token).then((valid) => {
    if (valid) {
      next();
    } else {
      res.status(401).json({ error: "Invalid session" });
    }
  });
}

router.get("/admin/status", async (_req, res) => {
  const configured = await isConfigured();
  res.json({ configured });
});

router.post("/admin/setup", async (req, res) => {
  if (await isConfigured()) {
    res.status(400).json({ error: "Admin already configured" });
    return;
  }
  const { login, password } = req.body;
  if (!login || !password || password.length < 3) {
    res.status(400).json({ error: "Login required, password min 3 characters" });
    return;
  }
  const token = await setupAdmin(login, password);
  res.json({ token });
});

router.post("/admin/login", async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    res.status(400).json({ error: "Login and password required" });
    return;
  }
  const token = await verifyLogin(login, password);
  if (token) {
    res.json({ token });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

router.post("/admin/logout", authMiddleware, async (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  await logout(token);
  res.json({ ok: true });
});

function maskDbUrl(url: string): string {
  return url.replace(/:\/\/[^:]+:([^@]+)@/, (m, p) => m.replace(p, "****"));
}

router.get("/admin/wallet-balances", authMiddleware, async (_req, res) => {
  try {
    const { listUnspent, getBalance, getAddressBalance } = await import("../lib/rpc");
    const devWallet = process.env["DEV_WALLET"] ?? "";
    const feeAddress = process.env["DEV_FEE_ADDRESS"] ?? "";
    const [unspent, total, dev, fee] = await Promise.all([
      listUnspent(),
      getBalance(),
      devWallet ? getAddressBalance(devWallet).catch(() => null) : Promise.resolve(null),
      feeAddress ? getAddressBalance(feeAddress).catch(() => null) : Promise.resolve(null),
    ]);
    let spendable = 0;
    for (const u of unspent) {
      if (u.safe_to_spend) spendable += u.amount;
    }
    res.json({
      total,
      spendable,
      addresses: {
        [devWallet]: { label: "Dev Wallet", address: devWallet, balance: dev?.balance ?? 0, received: dev?.received ?? 0 },
        [feeAddress]: { label: "Fee Address", address: feeAddress, balance: fee?.balance ?? 0, received: fee?.received ?? 0 },
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/admin/dashboard", authMiddleware, async (_req, res) => {
  const env = process.env;
  res.json({
    PORT: env["PORT"] ?? "",
    DATABASE_URL: maskDbUrl(env["DATABASE_URL"] ?? ""),
    DEV_WALLET: env["DEV_WALLET"] ?? "",
    DEV_FEE: env["DEV_FEE"] ?? "",
    DEV_FEE_ADDRESS: env["DEV_FEE_ADDRESS"] ?? "",
    NODE_RPC_HOST: env["NODE_RPC_HOST"] ?? "",
    NODE_RPC_PORT: env["NODE_RPC_PORT"] ?? "",
    NODE_RPC_COOKIE: env["NODE_RPC_COOKIE"] ?? "",
    URL_EXPLORER: env["URL_EXPLORER"] ?? "",
  });
});

const SERVICES: Record<string, { unit: string; hint: string }> = {
  node: { unit: "legacycoind", hint: "Node daemon · datadir /home/coin/.legacycoin · RPC 19556" },
  explorer: { unit: "legacycoin-explorer", hint: "Block explorer · HTTP 8084" },
  pool: { unit: "legacybtc-pool-reload", hint: "Docker container · restart recreates it and re-reads config/pool.env" },
};

const EXPLORER_STATUS_URL = process.env["EXPLORER_STATUS_URL"] ?? "http://127.0.0.1:8084/";

async function probeTcp(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (ok: boolean) => { socket.destroy(); resolve(ok); };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

async function serviceStatus(key: string): Promise<string> {
  try {
    switch (key) {
      case "node":
        await rpcCall("getblockcount", []);
        return "active";
      case "explorer": {
        const res = await fetch(EXPLORER_STATUS_URL, { method: "GET", signal: AbortSignal.timeout(3000) });
        return res.ok ? "active" : "inactive";
      }
      case "pool":
        return (await probeTcp("127.0.0.1", 3331)) ? "active" : "inactive";
      default:
        return "unknown";
    }
  } catch {
    return "inactive";
  }
}

async function systemctl(action: string, unit: string): Promise<{ ok: boolean; output: string }> {
  try {
    if (unit === "legacybtc-pool") {
      // --no-block через враппер: restart/stop собственного юнита не должен
      // обрывать процесс бэкенда до возврата ответа.
      const { stdout, stderr } = await execAsync("sudo", ["/usr/local/bin/legacybtc-pool-ctl", action, unit]);
      return { ok: true, output: stdout || stderr };
    }
    const { stdout, stderr } = await execAsync("sudo", ["systemctl", action, unit]);
    return { ok: true, output: stdout || stderr };
  } catch (err: any) {
    return { ok: false, output: err.stderr || err.message };
  }
}

router.get("/admin/services", authMiddleware, async (_req, res) => {
  const result: Record<string, any> = {};
  for (const [key, svc] of Object.entries(SERVICES)) {
    result[key] = { name: svc.unit, hint: svc.hint, status: await serviceStatus(key) };
  }
  res.json(result);
});

router.post("/admin/services/:name/:action", authMiddleware, async (req, res) => {
  const name = req.params.name as string;
  const action = req.params.action as string;
  const svc = SERVICES[name];
  if (!svc || !["start", "stop", "restart"].includes(action)) {
    res.status(400).json({ error: "Invalid service or action" });
    return;
  }
  const result = await systemctl(action, svc.unit);
  res.json(result);
});

router.get("/admin/config", authMiddleware, async (_req, res) => {
  const env = process.env;
  const raw: Record<string, string> = {};
  const keys = ["PORT", "STRATUM_PPLNS_PORT", "STRATUM_SOLO_PORT", "DATABASE_URL", "DEV_WALLET", "DEV_FEE", "DEV_FEE_ADDRESS",
    "NODE_RPC_HOST", "NODE_RPC_PORT", "NODE_RPC_USER", "NODE_RPC_PASS", "NODE_RPC_COOKIE", "URL_EXPLORER",
    "ADMIN_LOGIN", "ADMIN_PASSWORD"];
  for (const k of keys) raw[k] = env[k] ?? "";
  res.json(raw);
});

router.post("/admin/config", authMiddleware, async (req, res) => {
  const allowed = new Set(["PORT", "STRATUM_PPLNS_PORT", "STRATUM_SOLO_PORT", "DATABASE_URL", "DEV_WALLET", "DEV_FEE", "DEV_FEE_ADDRESS",
    "NODE_RPC_HOST", "NODE_RPC_PORT", "NODE_RPC_USER", "NODE_RPC_PASS", "NODE_RPC_COOKIE", "URL_EXPLORER"]);
  // Merge with the existing file so keys not managed by the panel (POSTGRES_*,
  // PPLNS_WINDOW, LOG_LEVEL, NODE_ENV, YESPOWER_CHECK_BIN, ...) are preserved.
  const current = new Map<string, string>();
  try {
    const existing = await readFile(ENV_PATH, "utf-8");
    for (const line of existing.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const sep = trimmed.indexOf("=");
      if (sep === -1) continue;
      current.set(trimmed.slice(0, sep), trimmed.slice(sep + 1));
    }
  } catch {
    // no existing file yet
  }
  for (const [key, val] of Object.entries(req.body)) {
    if (allowed.has(key) && typeof val === "string") {
      current.set(key, val);
    }
  }
  const lines = [...current.entries()].map(([key, val]) => `${key}=${val}`);
  lines.push("# Generated by admin panel");
  try {
    await writeFile(ENV_PATH, lines.join("\n") + "\n", "utf-8");
    await writeFile(ENV_RELOAD_PATH, new Date().toISOString() + "\n", "utf-8").catch(() => {});
    res.json({ ok: true, reload: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
