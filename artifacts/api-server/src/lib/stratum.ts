/**
 * Stratum TCP server for LegacyBTC (LBTC) mining pool.
 * Supports SOLO and PPLNS modes on separate ports.
 * 5% dev fee on both modes.
 *
 * Protocol: Stratum v1 (line-delimited JSON over TCP)
 * Algorithm: yespower (CPU mining, 32-bit nonce)
 */
import * as net from "net";
import * as crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { db, sharesTable, workersTable, blocksTable, payoutsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { poolState } from "./pool-state";
import { getBlockTemplate, submitBlock, type BlockTemplate } from "./rpc";
import { logger } from "./logger";
import { buildBlock, buildCoinbaseParts, buildMerkleTree, buildMerkleBranch, addressToScript, sha256d } from "./block-builder";

const execFileAsync = promisify(execFile);
const YESPOWER_CHECK = process.env["YESPOWER_CHECK_BIN"] ?? "./bin/yespower-check";
const YESPOWER_PERS = "LegacyCoinPoW";

async function computeYespowerHash(headerHex: string): Promise<string> {
  const { stdout } = await execFileAsync(YESPOWER_CHECK, [headerHex, YESPOWER_PERS], { timeout: 5000 });
  return stdout.trim();
}

function bitsToTargetHex(bitsHex: string): string {
  const bits = parseInt(bitsHex, 16);
  const mantissa = bits & 0xffffff;
  const exponent = (bits >>> 24) & 0xff;
  let target: bigint;
  if (exponent <= 3) {
    target = BigInt(mantissa >> (8 * (3 - exponent)));
  } else {
    target = BigInt(mantissa) << BigInt(8 * (exponent - 3));
  }
  return target.toString(16).padStart(64, "0");
}

function hashMeetsTarget(hashHex: string, targetHex: string): boolean {
  const hash = BigInt("0x" + hashHex);
  const target = BigInt("0x" + targetHex);
  return hash <= target;
}

function hashToBlockId(hashHex: string): string {
  const bytes = hashHex.match(/.{2}/g);
  if (!bytes) return hashHex;
  return bytes.reverse().join("");
}

const DEV_FEE = parseFloat(process.env["DEV_FEE"] ?? "0.05"); // 5%
const DEV_WALLET = process.env["DEV_WALLET"] ?? "LBTCdevXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
const PPLNS_WINDOW = parseInt(process.env["PPLNS_WINDOW"] ?? "100000"); // last N shares
const PAYOUT_THRESHOLD_BASE = parseInt(process.env["PAYOUT_THRESHOLD"] ?? "100000000"); // 1 LBTC in base units

// Track PPLNS round shares in memory
interface PplnsShare {
  address: string;
  difficulty: number;
  timestamp: number;
}
const pplnsRound: PplnsShare[] = [];

// Active job tracking
interface Job {
  id: string;
  template: BlockTemplate;
  target: string;
  difficulty: number;
  coinb1: string;
  coinb2: string;
  merkleBranch: string[];
  createdAt: number;
}
let currentJob: Job | null = null;
const recentJobs = new Map<string, Job>(); // jobId -> Job, keeps last 5 jobs
let jobRefreshTimer: ReturnType<typeof setInterval> | null = null;
let vardiffTimer: ReturnType<typeof setInterval> | null = null;

// Pending balances for PPLNS payouts (address -> base units)
const pendingBalances = new Map<string, number>();

function makeJobId(): string {
  return crypto.randomBytes(4).toString("hex");
}

// poolDiff1 matches the miner's constant: 0x00007fffff000000000000000000000000000000000000000000000000000000
const POOL_DIFF1 = BigInt("0x00007fffff000000000000000000000000000000000000000000000000000000");
const VARDIFF_TARGET_INTERVAL_MS = 30_000;
const VARDIFF_TARGET_SHARES_PER_SEC = 1 / 30; // ~1 share per 30 seconds per miner
const VARDIFF_MIN_DIFF = 1;
const VARDIFF_MAX_DIFF = 1_000_000;

// Per-client share timestamps for vardiff
const clientShares = new Map<string, number[]>();

function difficultyToTarget(difficulty: number): string {
  const target = POOL_DIFF1 / BigInt(Math.max(1, Math.floor(difficulty)));
  return target.toString(16).padStart(64, "0");
}

function targetToDifficulty(targetHex: string): number {
  const target = BigInt("0x" + targetHex);
  if (target === 0n) return VARDIFF_MIN_DIFF;
  const diff = Number(POOL_DIFF1 / target);
  return diff < VARDIFF_MIN_DIFF ? VARDIFF_MIN_DIFF : diff;
}

function recordClientShare(key: string): void {
  let timestamps = clientShares.get(key);
  if (!timestamps) {
    timestamps = [];
    clientShares.set(key, timestamps);
  }
  const now = Date.now();
  timestamps.push(now);
  // Keep only last 60 seconds
  const cutoff = now - 60_000;
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }
}

function calcClientDifficulty(key: string): number {
  const timestamps = clientShares.get(key);
  if (!timestamps || timestamps.length < 2) return VARDIFF_MIN_DIFF;
  const now = Date.now();
  const window = (now - timestamps[0]) / 1000;
  if (window < 1) return VARDIFF_MIN_DIFF;
  const shareRate = timestamps.length / window;
  const diff = Math.round(shareRate / VARDIFF_TARGET_SHARES_PER_SEC);
  return Math.max(VARDIFF_MIN_DIFF, Math.min(VARDIFF_MAX_DIFF, diff));
}

function broadcastJob(): void {
  if (!currentJob) return;
  for (const clients of clientsByServer.values()) {
    for (const client of clients) {
      if (client.subscribed) {
        sendJson(client, {
          id: null,
          method: "mining.notify",
          params: buildNotifyParams(currentJob, true),
        });
      }
    }
  }
}

async function refreshJob(): Promise<void> {
  try {
    const template = await getBlockTemplate();
    const difficulty = targetToDifficulty(template.target);

    // Build coinbase parts (without extranonce) and merkle branch for stratum notify
    // Use pool address for coinbase outputs — pool handles miner payouts via PPLNS/SOLO
    const poolScript = addressToScript(DEV_WALLET);
    const subsidy = template.coinbasevalue;
    const parts = buildCoinbaseParts(template.height, subsidy, poolScript, 0, poolScript);
    const dummyExtranonce1 = "ff000000";
    const dummyExtranonce2 = "00000000";
    const dummyCoinbase = Buffer.concat([
      parts.coinb1,
      Buffer.from(dummyExtranonce1, "hex"),
      Buffer.from(dummyExtranonce2, "hex"),
      parts.coinb2,
    ]);
    const txHashes: Buffer[] = [
      sha256d(dummyCoinbase),
      ...template.transactions.map((tx) => sha256d(Buffer.from(tx.data, "hex"))),
    ];
    const merkleBranch = buildMerkleBranch(txHashes);

    const newJob: Job = {
      id: makeJobId(),
      template,
      target: template.target,
      difficulty,
      coinb1: parts.coinb1.toString("hex"),
      coinb2: parts.coinb2.toString("hex"),
      merkleBranch,
      createdAt: Date.now(),
    };
    // Keep current job in cache for stale shares, then replace
    if (currentJob) {
      recentJobs.set(currentJob.id, currentJob);
      // Remove excess old jobs (keep max 5)
      if (recentJobs.size > 5) {
        const oldest = [...recentJobs.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
        recentJobs.delete(oldest[0]);
      }
    }
    currentJob = newJob;
//my-add    logger.debug({ height: template.height, jobId: currentJob.id }, "1. New job");
    broadcastJob();
  } catch (err) {
    logger.warn({ err }, "Failed to fetch block template");
  }
}

function buildNotifyParams(job: Job, cleanJobs = true): unknown[] {
  const t = job.template;
  return [
    job.id,
    t.previousblockhash,
    job.coinb1,
    job.coinb2,
    job.merkleBranch,
    t.version.toString(16).padStart(8, "0"),
    t.bits,
    t.curtime.toString(16).padStart(8, "0"),
    cleanJobs,
  ];
}

// Share validation is done inline in handleShare via yespower hash against job target.
// checkShareValid is no longer used.

interface MinerClient {
  socket: net.Socket;
  address: string;
  workerName: string;
  mode: "solo" | "pplns";
  authorized: boolean;
  subscribed: boolean;
  difficulty: number;
  extraNonce1: string;
  id: string;
}

// Track all connected clients for broadcasting new jobs
const clientsByServer = new Map<string, Set<MinerClient>>();

function sendJson(client: MinerClient, obj: unknown): void {
  if (!client.socket.destroyed) {
    client.socket.write(JSON.stringify(obj) + "\n");
  }
}

async function handleShare(client: MinerClient, jobId: string, nonce: string, extraNonce2?: string, nTime?: string): Promise<boolean> {
  const job = currentJob?.id === jobId ? currentJob : recentJobs.get(jobId);
  if (!job) {
    logger.warn({ jobId, currentJobId: currentJob?.id, recentJobIds: [...recentJobs.keys()] }, "Unknown job — share rejected");
    return false;
  }
  if (!nonce || nonce.length !== 8) return false;

  const template = job.template;
  if (!template) return false;

  const key = `${client.address}.${client.workerName}`;
  const mode = client.mode;

  // Build header and compute yespower for PoW validation
  try {
    const coinbaseTx = Buffer.concat([
      Buffer.from(job.coinb1, "hex"),
      Buffer.from(client.extraNonce1, "hex"),
      Buffer.from(extraNonce2 ?? "00000000", "hex"),
      Buffer.from(job.coinb2, "hex"),
    ]);
    const { blockHex, headerHash } = buildBlock(template, coinbaseTx, nonce, nTime);
    const headerHex = blockHex.slice(0, 160);

    const powHash = await computeYespowerHash(headerHex);
    const blockId = hashToBlockId(powHash);

    // Check share meets client difficulty target (vardiff-adjusted, not network target)
    const shareTarget = difficultyToTarget(client.difficulty);
    if (!hashMeetsTarget(blockId, shareTarget)) {
      logger.debug({ jobId, height: template.height, nonce, nTime, extraNonce2, worker: key, blockId: blockId.slice(0, 16) + "..." }, "Share below job target");
      return false;
    }

    // Check if share meets network difficulty
    const targetHex = bitsToTargetHex(template.bits);
    const powValid = hashMeetsTarget(blockId, targetHex);

    logger.debug({ jobId, height: template.height, nonce, nTime, extraNonce2, valid: true, worker: key, powValid }, "Share received");

    // Track share for vardiff
    recordClientShare(key);

    // Persist share to DB (fire-and-forget)
    db.insert(sharesTable).values({
      workerAddress: client.address,
      workerName: client.workerName,
      jobId,
      nonce,
      difficulty: client.difficulty,
      valid: true,
      blockHeight: template.height,
      mode,
    }).catch(err => logger.error({ err }, "Failed to insert share"));

    poolState.incrementValid(key, client.difficulty);

    // Update worker DB stats (fire-and-forget)
    db.insert(workersTable).values({
      address: client.address,
      workerName: client.workerName,
      hashrate: 0,
      validShares: 1,
      invalidShares: 0,
      lastSeen: new Date(),
      mode,
    }).onConflictDoUpdate({
      target: [workersTable.address, workersTable.workerName],
      set: {
        validShares: sql`${workersTable.validShares} + 1`,
        lastSeen: new Date(),
        updatedAt: new Date(),
      },
    }).catch(err => logger.error({ err }, "Failed to update worker stats"));

    // Track for PPLNS
    if (mode === "pplns") {
      pplnsRound.push({ address: client.address, difficulty: client.difficulty, timestamp: Date.now() });
      while (pplnsRound.length > PPLNS_WINDOW) pplnsRound.shift();
    }

    // Fire-and-forget: check if share meets network difficulty
    if (powValid) {
      checkBlockFound(client, job, blockHex, blockId, powHash, template, extraNonce2, nTime).catch((err) => {
        logger.error({ err, blockId: blockId.slice(0, 16) + "...", height: template.height }, "Background block check failed");
      });
    }

    return true;
  } catch (err) {
    logger.error({ err, jobId, worker: key }, "Share validation error");
    return false;
  }
}
async function checkBlockFound(
  client: MinerClient, job: Job, blockHex: string, blockId: string, powHash: string,
  template: BlockTemplate, extraNonce2?: string, nTime?: string
): Promise<void> {
  const blockRewardSat = template.coinbasevalue;

  try {
    const result = await submitBlock(blockHex);
    const rpcAccepted = result === null || result === "";
    const isOrphan = result === "duplicate";
    const isRejected = !rpcAccepted && !isOrphan;

    // ✅ ПРАВИЛЬНАЯ ЛОГИКА ПОДТВЕРЖДЕНИЯ
    const confirmed = rpcAccepted;  // Только явное принятие нодой
    
    logger.info({
      height: template.height,
      finder: client.address,
      mode: client.mode,
      reward: blockRewardSat,
      result,
      blockId: blockId.slice(0, 16) + "...",
      confirmed,
      isOrphan,
      isRejected,
    }, isOrphan ? "Block is orphan (duplicate)" : confirmed ? "Block accepted by network" : "Block rejected");

    // ✅ СОХРАНЯЕМ ВСЕГДА, даже если дубликат или rejected
    try {
      // Проверяем, существует ли уже такой хеш
      const [existingBlock] = await db.select().from(blocksTable).where(sql`hash = ${blockId}`).limit(1);
      
      if (existingBlock) {
        logger.info({ blockId: blockId.slice(0, 16) + "...", height: template.height, existingConfirmed: existingBlock.confirmed }, "Block already recorded, skipping insert");
        
        // Если это орфан и блок был помечен как confirmed — обновляем статус
        if (isOrphan && existingBlock.confirmed) {
          await db.update(blocksTable).set({ confirmed: false, submitResult: result }).where(sql`id = ${existingBlock.id}`);
          logger.info({ blockId: blockId.slice(0, 16) + "...", height: template.height }, "Block marked as orphan");
        }
        return;
      }

      // Новый блок — вставляем
      const [block] = await db.insert(blocksTable).values({
        height: template.height,
        hash: blockId,
        reward: blockRewardSat,
        finderAddress: client.address,
        foundAt: new Date(),
        confirmed: confirmed,  // true только при rpcAccepted
        mode: client.mode,
        devFee: Math.floor(blockRewardSat * DEV_FEE),
        txid: null,
        submitResult: result,
      }).returning();

      if (!block) {
        logger.warn({ blockId: blockId.slice(0, 16) + "...", height: template.height }, "Block insert returned no row");
        return;
      }

      // ✅ ВЫПЛАТЫ ТОЛЬКО ДЛЯ ПРИНЯТЫХ БЛОКОВ
      if (confirmed) {
        const minerAmount = blockRewardSat - Math.floor(blockRewardSat * DEV_FEE);
        if (client.mode === "solo") {
          await recordPayout(client.address, minerAmount, block.id);
        } else {
          await distributePplns(minerAmount, block.id);
        }
      } else {
        logger.info({ blockId: blockId.slice(0, 16) + "...", height: template.height, result }, "Block recorded but not confirmed (no payouts)");
      }

      await refreshJob();
    } catch (dbErr) {
      logger.error({ err: dbErr, blockId, height: template.height, result }, "Failed to record block");
    }
  } catch (err) {
    logger.warn({ err }, "Block submission failed");
  }
}

async function __checkBlockFound(
  client: MinerClient, job: Job, blockHex: string, blockId: string, powHash: string,
  template: BlockTemplate, extraNonce2?: string, nTime?: string
): Promise<void> {
  const blockRewardSat = template.coinbasevalue;

  try {
    logger.debug({
      height: template.height, headerHex: blockHex.slice(0, 160), nTime, extraNonce2,
      powHash: powHash.slice(0, 16) + "...",
      blockId: blockId.slice(0, 16) + "...",
    }, "Submitting block to RPC");

    const result = await submitBlock(blockHex);
    const rpcAccepted = result === null || result === "";

    // powValid is known true since checkBlockFound is only called for network-difficulty shares.
    // Always record the block — the reconciler will confirm/orphan it later.
    const confirmed = rpcAccepted || result === "duplicate";
    logger.info({ height: template.height, result, rpcAccepted, confirmed, blockId: blockId.slice(0, 16) + "..." }, "Block submission result from daemon");

    logger.info({
      height: template.height,
      finder: client.address,
      mode: client.mode,
      reward: blockRewardSat,
      result,
      blockId: blockId.slice(0, 16) + "...",
      powValid: true,
      confirmed,
    }, confirmed ? "Block accepted by network" : "Block found (unconfirmed)");

    try {
      const [block] = await db.insert(blocksTable).values({
        height: template.height,
        hash: blockId,
        reward: blockRewardSat,
        finderAddress: client.address,
        foundAt: new Date(),
        confirmed,
        mode: client.mode,
        devFee: Math.floor(blockRewardSat * DEV_FEE),
        txid: null,
        submitResult: result,
      }).onConflictDoNothing().returning();

      // Duplicate hash — already recorded by another miner/thread
      if (!block) return;

      if (confirmed) {
        const minerAmount = blockRewardSat - Math.floor(blockRewardSat * DEV_FEE);
        if (client.mode === "solo") {
          await recordPayout(client.address, minerAmount, block.id);
        } else {
          await distributePplns(minerAmount, block.id);
        }
      }

      await refreshJob();
    } catch (dbErr) {
      logger.error({ err: dbErr, blockId, height: template.height }, "Failed to record block");
    }
  } catch (err) {
    logger.warn({ err }, "Block submission failed");
  }
}

async function recordPayout(address: string, amount: number, blockId: number): Promise<void> {
  if (amount <= 0) return;

  // Add to pending balance
  pendingBalances.set(address, (pendingBalances.get(address) ?? 0) + amount);

  // Check if over threshold
  const balance = pendingBalances.get(address) ?? 0;
  if (balance >= PAYOUT_THRESHOLD_BASE) {
    await sendPayout(address, balance, blockId);
  } else {
    // Record as pending
    await db.insert(payoutsTable).values({
      address,
      amount,
      txid: null,
      blockId,
    });
  }
}

async function distributePplns(totalAmount: number, blockId: number): Promise<void> {
  if (pplnsRound.length === 0) return;

  const totalDiff = pplnsRound.reduce((sum, s) => sum + s.difficulty, 0);
  const shares = new Map<string, number>();

  for (const s of pplnsRound) {
    shares.set(s.address, (shares.get(s.address) ?? 0) + s.difficulty);
  }

  for (const [address, diff] of shares.entries()) {
    const share = diff / totalDiff;
    const amount = Math.floor(totalAmount * share);
    await recordPayout(address, amount, blockId);
  }
}

async function sendPayout(address: string, amount: number, blockId: number): Promise<void> {
  try {
    // In production: call sendmany RPC
    const amountLbtc = amount / 100000000;
    logger.info({ address, amountLbtc, blockId }, "Payout sent");

    await db.insert(payoutsTable).values({
      address,
      amount,
      txid: null, // would be filled from sendmany result
      blockId,
    });

    pendingBalances.delete(address);
  } catch (err) {
    logger.error({ err, address, amount }, "Payout failed");
  }
}

function buildBlockHex(_template: BlockTemplate, _nonce: string, _address: string): string {
  // In production: serialize full block with coinbase tx for pool address
  // This is a placeholder — full block serialization requires wire format implementation
  return "00" + _nonce;
}

function createStratumServer(mode: "solo" | "pplns", port: number): net.Server {
  const server = net.createServer((socket) => {
    const client: MinerClient = {
      socket,
      address: "",
      workerName: "default",
      mode,
      authorized: false,
      subscribed: false,
      difficulty: 1,
      extraNonce1: crypto.randomBytes(4).toString("hex"),
      id: crypto.randomBytes(8).toString("hex"),
    };

    const serverKey = `${mode}:${port}`;
    if (!clientsByServer.has(serverKey)) clientsByServer.set(serverKey, new Set());
    clientsByServer.get(serverKey)!.add(client);

    let buffer = "";

    socket.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line) as { id?: number; method?: string; params?: unknown[] };
          handleStratumMessage(client, msg);
        } catch (err) {
          logger.warn({ err, line }, "Invalid stratum message");
        }
      }
    });

    socket.on("close", () => {
      clientsByServer.get(serverKey)?.delete(client);
      const key = `${client.address}.${client.workerName}`;
      poolState.removeWorker(key);
      logger.debug({ address: client.address, worker: client.workerName }, "Miner disconnected");
    });

    socket.on("error", (err) => {
      logger.debug({ err }, "Socket error");
    });

    logger.debug({ mode, ip: socket.remoteAddress }, "Miner connected");
  });

  server.listen(port, "0.0.0.0", () => {
    logger.info({ mode, port }, `Stratum ${mode.toUpperCase()} server listening`);
  });

  server.on("error", (err) => {
    logger.error({ err, mode, port }, "Stratum server error");
  });

  return server;
}

function handleStratumMessage(
  client: MinerClient,
  msg: { id?: number; method?: string; params?: unknown[] }
): void {
  const { id, method, params = [] } = msg;

  switch (method) {
    case "mining.subscribe": {
      client.subscribed = true;
      sendJson(client, {
        id,
        result: [
          [["mining.set_difficulty", "1"], ["mining.notify", client.id]],
          client.extraNonce1,
          4, // extraNonce2 size
        ],
        error: null,
      });

      // Send initial difficulty
      sendJson(client, {
        id: null,
        method: "mining.set_difficulty",
        params: [client.difficulty],
      });

      // Send current job if available
      if (currentJob) {
        sendJson(client, {
          id: null,
          method: "mining.notify",
          params: buildNotifyParams(currentJob, false),
        });
      }
      break;
    }

    case "mining.authorize": {
      const workerStr = (params[0] as string) ?? "";
      const parts = workerStr.split(".");
      client.address = parts[0] ?? "";
      client.workerName = parts[1] ?? "default";
      client.authorized = true;

      const key = `${client.address}.${client.workerName}`;
      poolState.upsertWorker(key, {
        address: client.address,
        workerName: client.workerName,
        mode: client.mode,
      });

      sendJson(client, { id, result: true, error: null });
      logger.info({ address: client.address, worker: client.workerName, mode: client.mode }, "Miner authorized");

      // Send current job immediately to the new miner
      if (currentJob) {
        const notify = buildNotifyParams(currentJob, true);
        sendJson(client, { id: null, method: "mining.notify", params: notify });
        logger.debug({ jobId: currentJob.id, worker: key }, "Sent current job to new miner");
      }
      break;
    }

    case "mining.submit": {
      if (!client.authorized) {
        sendJson(client, { id, result: false, error: [24, "Unauthorized worker", null] });
        return;
      }
      const [, jobId, extraNonce2, nTime, nonce] = params as string[];
      handleShare(client, jobId, nonce, extraNonce2, nTime).then((valid) => {
        sendJson(client, { id, result: valid, error: valid ? null : [23, "Low difficulty share", null] });
      }).catch((err) => {
        logger.error({ err }, "Share handling error");
        sendJson(client, { id, result: false, error: [20, "Internal error", null] });
      });
      break;
    }

    case "mining.get_transactions": {
      sendJson(client, { id, result: [], error: null });
      break;
    }

    default: {
      sendJson(client, { id, result: null, error: [20, "Unknown method", null] });
    }
  }
}

export function startStratumServers(): void {
  const soloPort = parseInt(process.env["STRATUM_SOLO_PORT"] ?? "3331");
  const pplnsPort = parseInt(process.env["STRATUM_PPLNS_PORT"] ?? "3333");

  createStratumServer("solo", soloPort);
  createStratumServer("pplns", pplnsPort);

  // Start job refresh loop (every 20 seconds or on new block)
  void refreshJob();
  jobRefreshTimer = setInterval(() => {
    void refreshJob();
  }, 20000);

  // Variable difficulty adjustment (every 30 seconds)
  vardiffTimer = setInterval(() => {
    for (const clients of clientsByServer.values()) {
      for (const client of clients) {
        if (!client.subscribed) continue;
        const key = `${client.address}.${client.workerName}`;
        const newDiff = calcClientDifficulty(key);
        if (newDiff !== client.difficulty) {
          client.difficulty = newDiff;
          sendJson(client, {
            id: null,
            method: "mining.set_difficulty",
            params: [client.difficulty],
          });
          logger.debug({ worker: key, difficulty: client.difficulty }, "Vardiff updated");
        }
      }
    }
  }, VARDIFF_TARGET_INTERVAL_MS);

  logger.info({ soloPort, pplnsPort }, "Stratum servers started");
}

export function stopStratumServers(): void {
  if (jobRefreshTimer) {
    clearInterval(jobRefreshTimer);
    jobRefreshTimer = null;
  }
  if (vardiffTimer) {
    clearInterval(vardiffTimer);
    vardiffTimer = null;
  }
}

export { pendingBalances };
