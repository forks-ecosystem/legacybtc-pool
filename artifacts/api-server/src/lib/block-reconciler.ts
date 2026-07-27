import { db, blocksTable, payoutsTable } from "@workspace/db";
import { sql, eq, and, inArray, asc } from "drizzle-orm";
import { rpcCall, sendMany } from "./rpc";
import { logger } from "./logger";

const DEV_FEE = parseFloat(process.env["DEV_FEE"] ?? "0.05");
const DEV_FEE_ADDRESS = process.env["DEV_FEE_ADDRESS"] ?? "LTFN539rxb8X9jCfzEHin52Gdq8GWHYuut";
const RECONCILE_INTERVAL_MS = 60_000;
const SATOSHI = 100_000_000;
const COINBASE_MATURITY = 100;

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function getBlockHash(height: number): Promise<string | null> {
  try {
    const hash = await rpcCall("getblockhash", [height]);
    return hash as string;
  } catch {
    return null;
  }
}

async function getBlockHeader(hash: string): Promise<{ hash: string; confirmations: number; height: number } | null> {
  try {
    const info = await rpcCall("getblockheader", [hash]);
    return info as { hash: string; confirmations: number; height: number };
  } catch {
    return null;
  }
}

const RECONCILE_BATCH_DELAY_MS = 500;
const RECONCILE_MAX_PER_CYCLE = 10;

export async function reconcileBlocks(): Promise<void> {
  const unconfirmed = await db.select().from(blocksTable).where(eq(blocksTable.confirmed, false)).orderBy(asc(blocksTable.height));

  if (unconfirmed.length === 0) return;

  logger.info({ count: unconfirmed.length }, "Reconciling unconfirmed blocks");

  const batch = unconfirmed.slice(0, RECONCILE_MAX_PER_CYCLE);

  for (const block of batch) {
    try {
      const nodeHash = await getBlockHash(block.height);
      if (!nodeHash) {
        logger.warn({ height: block.height }, "getblockhash failed, skipping");
        await sleep(RECONCILE_BATCH_DELAY_MS);
        continue;
      }

      const header = await getBlockHeader(nodeHash);
      if (!header) {
        logger.warn({ height: block.height, nodeHash }, "getblockheader failed, skipping");
        await sleep(RECONCILE_BATCH_DELAY_MS);
        continue;
      }
      if (header.confirmations < COINBASE_MATURITY) {
        logger.info({ height: block.height, confirmations: header.confirmations, needed: COINBASE_MATURITY }, "Block not yet mature, skipping");
        await sleep(RECONCILE_BATCH_DELAY_MS);
        continue;
      }

      // If our recorded hash doesn't match the node's chain hash, this block is an orphan
      if (block.hash !== nodeHash) {
        logger.info({ height: block.height, hash: block.hash, nodeHash, blockId: block.id }, "Block is orphaned, deleting");
        await db.delete(blocksTable).where(eq(blocksTable.id, block.id));
        continue;
      }

      // Block is confirmed in chain — update DB and trigger payout
      await db.update(blocksTable)
        .set({ confirmed: true, txid: nodeHash })
        .where(eq(blocksTable.id, block.id));

      const minerAmount = block.reward - Math.floor(block.reward * DEV_FEE);

      // Check for existing payout for this block
      const existingPayout = await db.select()
        .from(payoutsTable)
        .where(eq(payoutsTable.blockId, block.id))
        .limit(1);

      if (existingPayout.length > 0) {
        logger.info({ height: block.height, hash: block.hash, nodeHash, blockId: block.id }, "Block reconciled, payout already exists");
        continue;
      }

      if (block.mode === "solo") {
        await db.insert(payoutsTable).values({
          address: block.finderAddress,
          amount: minerAmount,
          txid: null,
          blockId: block.id,
        });
      } else {
        const payouts = await db.execute(
          sql`
            WITH share_stats AS (
              SELECT worker_address, SUM(difficulty) as total_diff
              FROM shares
              WHERE block_height = ${block.height}
                AND mode = 'pplns'
                AND valid = true
              GROUP BY worker_address
            ), total AS (
              SELECT COALESCE(SUM(total_diff), 0) as grand_total FROM share_stats
            )
            SELECT worker_address,
                   FLOOR(${minerAmount} * total_diff / NULLIF(grand_total, 0)) as amount
            FROM share_stats, total
            WHERE grand_total > 0
          `
        );

        for (const row of payouts.rows as Array<{ worker_address: string; amount: number }>) {
          if (row.amount > 0) {
            await db.insert(payoutsTable).values({
              address: row.worker_address,
              amount: row.amount,
              txid: null,
              blockId: block.id,
            });
          }
        }
      }

      logger.info({ height: block.height, hash: block.hash, nodeHash, blockId: block.id }, "Block reconciled and payout created");
    } catch (err) {
      logger.error({ err, height: block.height, hash: block.hash }, "Block reconciliation failed");
    }
    await sleep(RECONCILE_BATCH_DELAY_MS);
  }
}

export async function processPendingPayouts(): Promise<void> {
  const pending = await db
    .select({
      id: payoutsTable.id,
      address: payoutsTable.address,
      amount: payoutsTable.amount,
      blockId: payoutsTable.blockId,
      blockReward: blocksTable.reward,
    })
    .from(payoutsTable)
    .innerJoin(blocksTable, eq(payoutsTable.blockId, blocksTable.id))
    .where(sql`${payoutsTable.txid} IS NULL`);

  if (pending.length === 0) return;

  // Group by address, sum amounts (base units)
  const addrMap = new Map<string, number>();
  const pendingIds: number[] = [];
  const seenBlocks = new Set<number>();
  let totalDevFee = 0;

  for (const p of pending) {
    pendingIds.push(p.id);
    addrMap.set(p.address, (addrMap.get(p.address) ?? 0) + p.amount);

    if (p.blockId != null && !seenBlocks.has(p.blockId)) {
      seenBlocks.add(p.blockId);
      totalDevFee += Math.floor(p.blockReward * DEV_FEE);
    }
  }

  // Convert base units to LBTC display units
  const outputs: Record<string, number> = {};
  for (const [addr, sat] of addrMap) {
    outputs[addr] = sat / SATOSHI;
  }

  if (totalDevFee > 0) {
    outputs[DEV_FEE_ADDRESS] = totalDevFee / SATOSHI;
  }

  try {
    const result = await sendMany(outputs, 0.0005); // 0.0005 LBTC = 50000 base units fee
    const txid = result.txid;

    // Update all processed payouts with the txid
    await db
      .update(payoutsTable)
      .set({ txid })
      .where(and(
        inArray(payoutsTable.id, pendingIds),
        sql`${payoutsTable.txid} IS NULL`,
      ));

    logger.info({
      txid,
      addresses: outputs,
      totalLbtc: Object.values(outputs).reduce((a, b) => a + b, 0),
      count: pending.length,
    }, "Payouts sent");
  } catch (err) {
    logger.warn({ err, outputs }, "sendmany failed, will retry");
  }
}

let reconcileTimer: ReturnType<typeof setInterval> | null = null;

export function startReconciler(): void {
  reconcileBlocks().catch((err) => logger.error({ err }, "Initial block reconciliation failed"));
  processPendingPayouts().catch((err) => logger.error({ err }, "Initial payout processing failed"));

  reconcileTimer = setInterval(() => {
    reconcileBlocks().catch((err) => logger.error({ err }, "Periodic block reconciliation failed"));
    processPendingPayouts().catch((err) => logger.error({ err }, "Periodic payout processing failed"));
  }, RECONCILE_INTERVAL_MS);

  logger.info({ intervalMs: RECONCILE_INTERVAL_MS }, "Block reconciler started");
}

export function stopReconciler(): void {
  if (reconcileTimer) {
    clearInterval(reconcileTimer);
    reconcileTimer = null;
  }
}
