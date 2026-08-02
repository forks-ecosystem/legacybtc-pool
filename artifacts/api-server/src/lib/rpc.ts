import { readFileSync } from "fs";
import { logger } from "./logger";

const RPC_HOST = process.env["NODE_RPC_HOST"] ?? "127.0.0.1";
const RPC_PORT = process.env["NODE_RPC_PORT"] ?? "19556";

function getRPCCredentials(): { user: string; pass: string } {
  const cookiePath = process.env["NODE_RPC_COOKIE"];
  if (cookiePath) {
    const cookie = readFileSync(cookiePath, "utf-8").trim();
    const sep = cookie.indexOf(":");
    if (sep === -1) {
      throw new Error(`Invalid cookie file format at ${cookiePath}: expected "user:password"`);
    }
    return { user: cookie.slice(0, sep), pass: cookie.slice(sep + 1) };
  }
  return {
    user: process.env["NODE_RPC_USER"] ?? "rpcuser",
    pass: process.env["NODE_RPC_PASS"] ?? "rpcpassword",
  };
}

const RPC_CRED = getRPCCredentials();

const RPC_MAX_RETRIES = 5;

async function rpcCallWithRetry(
  method: string,
  params: unknown[] = [],
  attempt = 1,
): Promise<unknown> {
  const url = `http://${RPC_HOST}:${RPC_PORT}`;
  const body = JSON.stringify({ jsonrpc: "1.0", id: "pool", method, params });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": "Basic " + Buffer.from(`${RPC_CRED.user}:${RPC_CRED.pass}`).toString("base64"),
  };

  const res = await fetch(url, { method: "POST", headers, body });
  if (res.status === 429) {
    if (attempt > RPC_MAX_RETRIES) {
      throw new Error(`RPC rate limited after ${RPC_MAX_RETRIES} retries: ${method}`);
    }
    const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
    logger.warn({ method, attempt, delay }, "RPC rate limited, retrying");
    await new Promise(r => setTimeout(r, delay));
    return rpcCallWithRetry(method, params, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`RPC HTTP error ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (json.error) {
    throw new Error(`RPC error: ${json.error.message}`);
  }
  return json.result;
}

export async function rpcCall(method: string, params: unknown[] = []): Promise<unknown> {
  return rpcCallWithRetry(method, params);
}

export interface BlockTemplate {
  version: number;
  previousblockhash: string;
  merkleroot: string;
  transactions: Array<{ data: string; hash: string; fee: number }>;
  coinbasevalue: number;
  target: string;
  bits: string;
  height: number;
  curtime: number;
  hex?: string;
  coinbasetxn?: { data: string; hash: string; };
}

export async function getBlockTemplate(): Promise<BlockTemplate> {
  return rpcCall("getblocktemplate", []) as Promise<BlockTemplate>;
}

export async function submitBlock(blockHex: string): Promise<string | null> {
  try {
    const result = await rpcCall("submitblock", [blockHex]);
    logger.info({ submitResult: result }, "submitblock RPC response");
    return result as string | null;
  } catch (err) {
    logger.error({ err }, "submitblock failed");
    return "failed";
  }
}

export interface BlockchainInfo {
  blocks: number;
  difficulty: number;
  networkhashps?: number | { hps: number };
  current_bits?: string;
}

const DIFF1_TARGET = BigInt("0x00007fffff000000000000000000000000000000000000000000000000000000");

// Expected hashes to find one share at difficulty 1 for this coin's diff1 target.
// Bitcoin uses 2^32; for this coin's target, it's 2^256 / DIFF1_TARGET ≈ 33,554,052.
export const DIFF1_HASHES = Number(2n ** 256n / DIFF1_TARGET);

function bitsToDifficulty(bitsHex: string): number {
  const bits = parseInt(bitsHex, 16);
  const mantissa = bits & 0xffffff;
  const exponent = (bits >>> 24) & 0xff;
  const target = exponent <= 3
    ? BigInt(mantissa >> (8 * (3 - exponent)))
    : BigInt(mantissa) << BigInt(8 * (exponent - 3));
  if (target === 0n) return 0;
  return Number(DIFF1_TARGET / target);
}

export async function getBlockchainInfo(): Promise<BlockchainInfo> {
  const raw = await rpcCall("getblockchaininfo", []) as BlockchainInfo;
  if (!raw.difficulty && raw.current_bits) {
    raw.difficulty = bitsToDifficulty(raw.current_bits);
  }
  return raw;
}

export interface SendManyResult {
  txid: string;
}

export async function sendMany(amounts: Record<string, number>, feeLbtc?: number): Promise<SendManyResult> {
  const params: unknown[] = ["", amounts];
  if (feeLbtc !== undefined) {
    // sendmany params: [account, outputs, minconf?, comment?, subtractfeefrom?, ?, fee?]
    while (params.length < 6) params.push(null);
    params.push(feeLbtc);
  }
  return rpcCall("sendmany", params) as Promise<SendManyResult>;
}

export async function isNodeReachable(): Promise<boolean> {
  try {
    await getBlockchainInfo();
    return true;
  } catch {
    return false;
  }
}

export interface ValidateAddressResult {
  isvalid: boolean;
  address: string;
  ismine: boolean;
  isscript: boolean;
  pubkey?: string;
}

export async function validateAddress(address: string): Promise<ValidateAddressResult> {
  return rpcCall("validateaddress", [address]) as Promise<ValidateAddressResult>;
}

export interface Utxo {
  txid: string;
  vout: number;
  address?: string;
  amount: number;
  confirmations: number;
  coinbase?: boolean;
  safe_to_spend?: boolean;
}

export async function listUnspent(minconf = 0, maxconf = 9999999): Promise<Utxo[]> {
  return rpcCall("listunspent", [minconf, maxconf]) as Promise<Utxo[]>;
}

export async function getBalance(): Promise<number> {
  return rpcCall("getbalance", []) as Promise<number>;
}
