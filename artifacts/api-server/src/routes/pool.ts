import { Router, type IRouter } from "express";
import { desc, eq, count, sum, sql, and, gte, inArray } from "drizzle-orm";
import { db, sharesTable, workersTable, blocksTable, payoutsTable } from "@workspace/db";
import {
  GetPoolStatsResponse,
  GetPoolDashboardResponse,
  GetPoolConfigResponse,
  ListBlocksQueryParams,
  ListBlocksResponse,
  ListPayoutsQueryParams,
  ListPayoutsResponse,
  ListMinersQueryParams,
  ListMinersResponse,
  GetMinerParams,
  GetMinerResponse,
  GetMinerPayoutsParams,
  GetMinerPayoutsResponse,
  GetMinerSharesParams,
  GetMinerSharesResponse,
} from "@workspace/api-zod";
import { poolState } from "../lib/pool-state";
import { isNodeReachable, getBlockchainInfo, DIFF1_HASHES } from "../lib/rpc";

const router: IRouter = Router();

const SATOSHI = 100000000;
const STRATUM_HOST = process.env["STRATUM_HOST"] ?? "pool.legacybtc.example.com";
const SOLO_PORT = parseInt(process.env["STRATUM_SOLO_PORT"] ?? "3331");
const PPLNS_PORT = parseInt(process.env["STRATUM_PPLNS_PORT"] ?? "3333");
const DEV_FEE = Math.round(parseFloat(process.env["DEV_FEE"] ?? "0.05") * 100); // percent
const PAYOUT_THRESHOLD = 3; // LBTC

// Helper: format satoshis to LBTC float
function toCoins(satoshis: number): number {
  return satoshis / SATOSHI;
}

// GET /pool/stats
router.get("/pool/stats", async (req, res): Promise<void> => {
  try {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);

    // Active workers from DB (last 15 min)
    const [activeWorkers] = await db
      .select({ count: count() })
      .from(workersTable)
      .where(gte(workersTable.lastSeen, cutoff));

    const [activeMiners] = await db
      .select({ count: sql<number>`count(distinct address)::int` })
      .from(workersTable)
      .where(gte(workersTable.lastSeen, cutoff));

    // Pool hashrate from recent shares (last 15 min)
    const [hashrateResult] = await db
      .select({
        shares: sql<number>`count(*)::int`,
        totalDiff: sql<number>`coalesce(sum(difficulty), 0)`,
      })
      .from(sharesTable)
      .where(gte(sharesTable.createdAt, cutoff));

    const diffSum = Number(hashrateResult?.totalDiff ?? 0);
    const poolHashrate = diffSum * DIFF1_HASHES / 900;

    // DB aggregates
    const [blockStats] = await db
      .select({
        total: sql<number>`count(distinct height)::int`,
        solo: sql<number>`count(distinct height) filter (where mode = 'solo')::int`,
        pplns: sql<number>`count(distinct height) filter (where mode = 'pplns')::int`,
        lastFound: sql<string | null>`max(found_at)`,
      })
      .from(blocksTable);

    const [payoutSum] = await db
      .select({ total: sum(payoutsTable.amount) })
      .from(payoutsTable);

    // Network info from node (best-effort)
    let networkDifficulty = 0;
    let networkHashrate = 0;
    let blockHeight = 0;
    try {
      const info = await getBlockchainInfo();
      networkDifficulty = info.difficulty ?? 0;
      networkHashrate = typeof info.networkhashps === 'object' && info.networkhashps !== null ? info.networkhashps.hps ?? 0 : (info.networkhashps as number) ?? 0;
      blockHeight = info.blocks ?? 0;
    } catch {
      // node unreachable — return cached zeros
    }

    const result = GetPoolStatsResponse.parse({
      hashrate: poolHashrate,
      activeMiners: activeMiners?.count ?? 0,
      activeWorkers: activeWorkers?.count ?? 0,
      totalBlocksFound: blockStats?.total ?? 0,
      soloBlocksFound: blockStats?.solo ?? 0,
      pplnsBlocksFound: blockStats?.pplns ?? 0,
      networkDifficulty,
      networkHashrate,
      blockHeight,
      lastBlockFoundAt: blockStats?.lastFound ?? null,
      totalPaidOut: toCoins(Number(payoutSum?.total ?? 0)),
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "getPoolStats failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /pool/config
router.get("/pool/config", async (_req, res): Promise<void> => {
  const result = GetPoolConfigResponse.parse({
    stratumHost: STRATUM_HOST,
    soloPort: SOLO_PORT,
    pplnsPort: PPLNS_PORT,
    devFeePercent: DEV_FEE,
    payoutThreshold: PAYOUT_THRESHOLD,
    coin: "Legacy Coin",
    ticker: "LBTC",
    algorithm: "yespower",
  });
  res.json(result);
});

// GET /pool/dashboard
router.get("/pool/dashboard", async (req, res): Promise<void> => {
  try {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);

    // Active workers from DB (last 15 min)
    const [activeWorkers] = await db
      .select({ count: count() })
      .from(workersTable)
      .where(gte(workersTable.lastSeen, cutoff));

    const [activeMiners] = await db
      .select({ count: sql<number>`count(distinct address)::int` })
      .from(workersTable)
      .where(gte(workersTable.lastSeen, cutoff));

    // Pool hashrate from recent shares (last 15 min)
    const [hashrateResult] = await db
      .select({
        shares: sql<number>`count(*)::int`,
        totalDiff: sql<number>`coalesce(sum(difficulty), 0)`,
      })
      .from(sharesTable)
      .where(gte(sharesTable.createdAt, cutoff));

    const diffSum = Number(hashrateResult?.totalDiff ?? 0);
    const poolHashrate = diffSum * DIFF1_HASHES / 900;

    // DB aggregates
    const [blockStats] = await db
      .select({
        total: sql<number>`count(distinct height)::int`,
        solo: sql<number>`count(distinct height) filter (where mode = 'solo')::int`,
        pplns: sql<number>`count(distinct height) filter (where mode = 'pplns')::int`,
        lastFound: sql<string | null>`max(found_at)`,
      })
      .from(blocksTable);

    const [payoutSum] = await db
      .select({ total: sum(payoutsTable.amount) })
      .from(payoutsTable);

    let networkDifficulty = 0, networkHashrate = 0, blockHeight = 0;
    try {
      const info = await getBlockchainInfo();
      networkDifficulty = info.difficulty ?? 0;
      networkHashrate = typeof info.networkhashps === 'object' && info.networkhashps !== null ? info.networkhashps.hps ?? 0 : (info.networkhashps as number) ?? 0;
      blockHeight = info.blocks ?? 0;
    } catch { /* node offline */ }

    const recentBlocksRaw = await db
      .select()
      .from(blocksTable)
      .orderBy(desc(blocksTable.foundAt))
      .limit(10);

    // dedup: per height, prefer confirmed, else keep latest
    const seenBlocks = new Map<number, typeof recentBlocksRaw[0]>();
    for (const row of recentBlocksRaw) {
      const existing = seenBlocks.get(row.height);
      if (!existing || row.confirmed || (!existing.confirmed && row.foundAt > existing.foundAt)) {
        seenBlocks.set(row.height, row);
      }
    }
    const recentBlocks = [...seenBlocks.values()].slice(0, 5);

    const recentPayoutsRaw = await db
      .select()
      .from(payoutsTable)
      .orderBy(desc(payoutsTable.createdAt))
      .limit(10);

    // Top miners by valid shares
    const topMinersRaw = await db
      .select({
        address: workersTable.address,
        workerCount: sql<number>`count(*)::int`,
        lastSeen: sql<Date>`max(last_seen)`,
        validShares: sql<number>`sum(valid_shares)::int`,
        invalidShares: sql<number>`sum(invalid_shares)::int`,
        mode: sql<string | null>`(array_agg(mode order by last_seen desc))[1]`,
      })
      .from(workersTable)
      .groupBy(workersTable.address)
      .orderBy(desc(sql`sum(valid_shares)`))
      .limit(10);

    // Hashrate for each miner from recent shares
    const topAddrs = topMinersRaw.map(m => m.address);
    const minerHashrates: Map<string, number> = new Map();
    if (topAddrs.length > 0) {
      const raw = await db
        .select({
          address: sharesTable.workerAddress,
          hashrate: sql<number>`coalesce(sum(difficulty), 0) * ${DIFF1_HASHES} / 900`,
        })
        .from(sharesTable)
        .where(and(
          gte(sharesTable.createdAt, cutoff),
          inArray(sharesTable.workerAddress, topAddrs),
        ))
        .groupBy(sharesTable.workerAddress);
      for (const r of raw) minerHashrates.set(r.address, r.hashrate);
    }

    const payoutsByAddress = await db
      .select({
        address: payoutsTable.address,
        total: sum(payoutsTable.amount),
      })
      .from(payoutsTable)
      .groupBy(payoutsTable.address);

    const payoutMap = new Map(payoutsByAddress.map(p => [p.address, Number(p.total ?? 0)]));

    const pendingByAddress = await db
      .select({
        address: payoutsTable.address,
        total: sum(payoutsTable.amount),
      })
      .from(payoutsTable)
      .where(sql`${payoutsTable.txid} IS NULL`)
      .groupBy(payoutsTable.address);

    const pendingMap = new Map(pendingByAddress.map(p => [p.address, Number(p.total ?? 0)]));

    const result = GetPoolDashboardResponse.parse({
      stats: {
        hashrate: poolHashrate,
        activeMiners: activeMiners?.count ?? 0,
        activeWorkers: activeWorkers?.count ?? 0,
        totalBlocksFound: blockStats?.total ?? 0,
        soloBlocksFound: blockStats?.solo ?? 0,
        pplnsBlocksFound: blockStats?.pplns ?? 0,
        networkDifficulty,
        networkHashrate,
        blockHeight,
        lastBlockFoundAt: blockStats?.lastFound ?? null,
        totalPaidOut: toCoins(Number(payoutSum?.total ?? 0)),
      },
      recentBlocks: recentBlocks.map(b => ({
        id: b.id,
        height: b.height,
        hash: b.hash,
        reward: toCoins(b.reward),
        finderAddress: b.finderAddress,
        foundAt: b.foundAt.toISOString(),
        confirmed: b.confirmed,
        mode: b.mode as "solo" | "pplns",
        devFee: toCoins(b.devFee),
        txid: b.txid,
      })),
      recentPayouts: recentPayoutsRaw.map(p => ({
        id: p.id,
        address: p.address,
        amount: toCoins(p.amount),
        txid: p.txid,
        createdAt: p.createdAt.toISOString(),
        blockId: p.blockId,
      })),
      topMiners: topMinersRaw.map(m => ({
        address: m.address,
        hashrate: minerHashrates.get(m.address) ?? 0,
        workerCount: m.workerCount ?? 1,
        lastSeen: m.lastSeen instanceof Date ? m.lastSeen.toISOString() : new Date(m.lastSeen).toISOString(),
        totalShares: (m.validShares ?? 0) + (m.invalidShares ?? 0),
        validShares: m.validShares ?? 0,
        pendingBalance: toCoins(pendingMap.get(m.address) ?? 0),
        totalPaid: toCoins(payoutMap.get(m.address) ?? 0),
        mode: (m.mode as "solo" | "pplns" | null) ?? null,
      })),
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "getPoolDashboard failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /pool/blocks
router.get("/pool/blocks", async (req, res): Promise<void> => {
  try {
    const query = ListBlocksQueryParams.safeParse(req.query);
    const limit = query.success ? (query.data.limit ?? 20) : 20;
    const offset = query.success ? (query.data.offset ?? 0) : 0;
    const mode = query.success ? query.data.mode : undefined;

    // Dedup per height in SQL (prefer confirmed, else latest found), then paginate.
    // Note: no DISTINCT ON in this drizzle build, so use row_number() window.
    const modeWhere = mode ? sql`WHERE mode = ${mode}` : sql``;
    const [bResult, tResult] = await Promise.all([
      db.execute(sql`
        SELECT id, height, hash, reward, finder_address, found_at, confirmed, mode, dev_fee, txid, submit_result
        FROM (
          SELECT *, row_number() OVER (PARTITION BY height ORDER BY confirmed DESC, found_at DESC) AS rn
          FROM blocks
          ${modeWhere}
        ) d
        WHERE rn = 1
        ORDER BY found_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      db.execute(sql`
        SELECT count(DISTINCT height) AS total FROM blocks ${modeWhere}
      `),
    ]);
    const rows = bResult.rows ?? (bResult as any);
    const total = Number(((tResult.rows ?? tResult)[0] as any).total);

    const parsed = ListBlocksResponse.parse({
      blocks: rows.map((b: any) => ({
        id: b.id,
        height: b.height,
        hash: b.hash,
        reward: toCoins(Number(b.reward)),
        finderAddress: b.finder_address,
        foundAt: new Date(b.found_at).toISOString(),
        confirmed: b.confirmed,
        mode: (b.mode as "solo" | "pplns") ?? "pplns",
        devFee: toCoins(Number(b.dev_fee)),
        txid: b.txid ?? null,
      })),
      total,
    });

    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "listBlocks failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /pool/payouts
router.get("/pool/payouts", async (req, res): Promise<void> => {
  try {
    const query = ListPayoutsQueryParams.safeParse(req.query);
    const limit = query.success ? (query.data.limit ?? 20) : 20;
    const offset = query.success ? (query.data.offset ?? 0) : 0;

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(payoutsTable).orderBy(desc(payoutsTable.createdAt)).limit(limit).offset(offset),
      db.select({ total: count() }).from(payoutsTable),
    ]);

    const result = ListPayoutsResponse.parse({
      payouts: rows.map(p => ({
        id: p.id,
        address: p.address,
        amount: toCoins(p.amount),
        txid: p.txid,
        createdAt: p.createdAt.toISOString(),
        blockId: p.blockId,
      })),
      total,
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "listPayouts failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /pool/miners
router.get("/pool/miners", async (req, res): Promise<void> => {
  try {
    const query = ListMinersQueryParams.safeParse(req.query);
    const limit = query.success ? (query.data.limit ?? 50) : 50;
    const offset = query.success ? (query.data.offset ?? 0) : 0;
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);

    const [minersRaw, [{ total }]] = await Promise.all([
      db
        .select({
          address: workersTable.address,
          workerCount: sql<number>`count(*)::int`,
          lastSeen: sql<Date>`max(last_seen)`,
          validShares: sql<number>`sum(valid_shares)::int`,
          invalidShares: sql<number>`sum(invalid_shares)::int`,
          mode: sql<string | null>`(array_agg(mode order by last_seen desc))[1]`,
        })
        .from(workersTable)
        .groupBy(workersTable.address)
        .orderBy(desc(sql`sum(valid_shares)`))
        .limit(limit)
        .offset(offset),
      db.select({ total: sql<number>`count(distinct address)::int` }).from(workersTable),
    ]);

    // Hashrate for each miner from recent shares
    const minerAddrs = minersRaw.map(m => m.address);
    const minerHashrates2: Map<string, number> = new Map();
    if (minerAddrs.length > 0) {
      const raw = await db
        .select({
          address: sharesTable.workerAddress,
          hashrate: sql<number>`coalesce(sum(difficulty), 0) * ${DIFF1_HASHES} / 900`,
        })
        .from(sharesTable)
        .where(and(
          gte(sharesTable.createdAt, cutoff),
          inArray(sharesTable.workerAddress, minerAddrs),
        ))
        .groupBy(sharesTable.workerAddress);
      for (const r of raw) minerHashrates2.set(r.address, r.hashrate);
    }

    const payoutsByAddress = await db
      .select({ address: payoutsTable.address, total: sum(payoutsTable.amount) })
      .from(payoutsTable)
      .groupBy(payoutsTable.address);

    const payoutMap = new Map(payoutsByAddress.map(p => [p.address, Number(p.total ?? 0)]));

    const pendingByAddress2 = await db
      .select({
        address: payoutsTable.address,
        total: sum(payoutsTable.amount),
      })
      .from(payoutsTable)
      .where(sql`${payoutsTable.txid} IS NULL`)
      .groupBy(payoutsTable.address);

    const pendingMap2 = new Map(pendingByAddress2.map(p => [p.address, Number(p.total ?? 0)]));

    const result = ListMinersResponse.parse({
      miners: minersRaw.map(m => ({
        address: m.address,
        hashrate: minerHashrates2.get(m.address) ?? 0,
        workerCount: m.workerCount ?? 1,
        lastSeen: m.lastSeen instanceof Date ? m.lastSeen.toISOString() : new Date(m.lastSeen).toISOString(),
        totalShares: (m.validShares ?? 0) + (m.invalidShares ?? 0),
        validShares: m.validShares ?? 0,
        pendingBalance: toCoins(pendingMap2.get(m.address) ?? 0),
        totalPaid: toCoins(payoutMap.get(m.address) ?? 0),
        mode: (m.mode as "solo" | "pplns" | null) ?? null,
      })),
      total: total ?? 0,
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "listMiners failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /pool/miners/:address
router.get("/pool/miners/:address", async (req, res): Promise<void> => {
  try {
    const params = GetMinerParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid address" });
      return;
    }
    const { address } = params.data;

    const cutoff = new Date(Date.now() - 15 * 60 * 1000);

    const [shareStats] = await db
      .select({
        totalShares: sql<number>`count(*)::int`,
        validShares: sql<number>`sum(case when valid then 1 else 0 end)::int`,
        invalidShares: sql<number>`sum(case when not valid then 1 else 0 end)::int`,
        lastSeen: sql<Date | null>`max(created_at)`,
        workerCount: sql<number>`count(distinct worker_name)::int`,
        recentDiff: sql<number>`coalesce(sum(case when created_at >= ${cutoff} then difficulty else 0 end), 0)`,
      })
      .from(sharesTable)
      .where(eq(sharesTable.workerAddress, address));

    if (!shareStats || shareStats.totalShares === 0) {
      res.status(404).json({ error: "Miner not found" });
      return;
    }

    const hashrate = Number(shareStats.recentDiff ?? 0) * DIFF1_HASHES / 900;

    const workersRaw = await db
      .select()
      .from(workersTable)
      .where(eq(workersTable.address, address))
      .orderBy(desc(workersTable.lastSeen));

    // Calculate per-worker hashrate from recent shares
    const workerHashrates = await db
      .select({
        name: sharesTable.workerName,
        hashrate: sql<number>`coalesce(sum(difficulty), 0) * ${DIFF1_HASHES} / 900`,
      })
      .from(sharesTable)
      .where(and(
        eq(sharesTable.workerAddress, address),
        gte(sharesTable.createdAt, cutoff),
      ))
      .groupBy(sharesTable.workerName);

    const hashrateMap = new Map(workerHashrates.map(w => [w.name, w.hashrate]));

    const [payoutSum] = await db
      .select({ total: sum(payoutsTable.amount) })
      .from(payoutsTable)
      .where(eq(payoutsTable.address, address));

    const [pendingSum] = await db
      .select({ total: sum(payoutsTable.amount) })
      .from(payoutsTable)
      .where(and(eq(payoutsTable.address, address), sql`${payoutsTable.txid} IS NULL`));

    const [blockCount] = await db
      .select({ total: sql<number>`count(distinct height)::int` })
      .from(blocksTable)
      .where(eq(blocksTable.finderAddress, address));

    const result = GetMinerResponse.parse({
      address,
      hashrate,
      workerCount: shareStats.workerCount,
      workers: workersRaw.length > 0 ? workersRaw.map(w => ({
        name: w.workerName,
        hashrate: hashrateMap.get(w.workerName) ?? 0,
        lastSeen: w.lastSeen.toISOString(),
        validShares: w.validShares,
      })) : [],
      lastSeen: shareStats.lastSeen ? new Date(shareStats.lastSeen).toISOString() : new Date().toISOString(),
      totalShares: shareStats.totalShares,
      validShares: shareStats.validShares,
      invalidShares: shareStats.invalidShares,
      pendingBalance: toCoins(Number(pendingSum?.total ?? 0)),
      totalPaid: toCoins(Number(payoutSum?.total ?? 0)),
      blocksFound: blockCount?.total ?? 0,
      mode: workersRaw.length > 0 ? (workersRaw[0]?.mode as "solo" | "pplns" | null) ?? null : null,
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "getMiner failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /pool/miners/:address/payouts
router.get("/pool/miners/:address/payouts", async (req, res): Promise<void> => {
  try {
    const params = GetMinerPayoutsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid address" });
      return;
    }
    const { address } = params.data;

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(payoutsTable)
        .where(eq(payoutsTable.address, address))
        .orderBy(desc(payoutsTable.createdAt))
        .limit(50),
      db.select({ total: count() }).from(payoutsTable)
        .where(eq(payoutsTable.address, address)),
    ]);

    const result = GetMinerPayoutsResponse.parse({
      payouts: rows.map(p => ({
        id: p.id,
        address: p.address,
        amount: toCoins(p.amount),
        txid: p.txid,
        createdAt: p.createdAt.toISOString(),
        blockId: p.blockId,
      })),
      total,
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "getMinerPayouts failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /pool/miners/:address/shares
router.get("/pool/miners/:address/shares", async (req, res): Promise<void> => {
  try {
    const params = GetMinerSharesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid address" });
      return;
    }
    const { address } = params.data;

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(sharesTable)
        .where(eq(sharesTable.workerAddress, address))
        .orderBy(desc(sharesTable.createdAt))
        .limit(100),
      db.select({ total: count() }).from(sharesTable)
        .where(eq(sharesTable.workerAddress, address)),
    ]);

    const result = GetMinerSharesResponse.parse({
      shares: rows.map(s => ({
        id: s.id,
        workerAddress: s.workerAddress,
        workerName: s.workerName,
        difficulty: s.difficulty,
        valid: s.valid,
        createdAt: s.createdAt.toISOString(),
        mode: s.mode as "solo" | "pplns",
      })),
      total,
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "getMinerShares failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
