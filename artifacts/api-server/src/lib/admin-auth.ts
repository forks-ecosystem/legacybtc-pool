import { readFile, writeFile, access } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";

const CONFIG_PATH = path.resolve(
  process.cwd(), "config", "admin.json",
);

interface AdminConfig {
  login: string;
  passwordHash: string;
  sessionToken: string | null;
}

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function isConfigured(): Promise<boolean> {
  try {
    await access(CONFIG_PATH);
    return true;
  } catch {
    return false;
  }
}

export async function setupAdmin(login: string, password: string): Promise<string> {
  const token = generateToken();
  const config: AdminConfig = {
    login,
    passwordHash: hashPassword(password),
    sessionToken: token,
  };
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  return token;
}

export async function verifyLogin(login: string, password: string): Promise<string | null> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const config: AdminConfig = JSON.parse(raw);
    if (config.login === login && config.passwordHash === hashPassword(password)) {
      const token = generateToken();
      config.sessionToken = token;
      await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
      return token;
    }
    return null;
  } catch {
    return null;
  }
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const config: AdminConfig = JSON.parse(raw);
    return config.sessionToken === token;
  } catch {
    return false;
  }
}

export async function logout(token: string): Promise<void> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const config: AdminConfig = JSON.parse(raw);
    if (config.sessionToken === token) {
      config.sessionToken = null;
      await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
    }
  } catch {
    // ignore
  }
}
