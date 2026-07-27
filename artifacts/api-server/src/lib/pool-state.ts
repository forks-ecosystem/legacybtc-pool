import { DIFF1_HASHES } from './rpc';

/**
 * In-memory pool state shared between the Stratum server and the HTTP API.
 * Tracks live worker connections and hashrate estimates.
 */

export interface WorkerState {
  address: string;
  workerName: string;
  mode: "solo" | "pplns";
  hashrate: number;
  validShares: number;
  invalidShares: number;
  difficulty: number;
  lastSeen: Date;
  connectedAt: Date;
}

class PoolState {
  private workers = new Map<string, WorkerState>();
  private totalValidShares = 0;
  private totalInvalidShares = 0;

  upsertWorker(key: string, data: Partial<WorkerState> & { address: string; workerName: string; mode: "solo" | "pplns" }): void {
    const existing = this.workers.get(key);
    if (existing) {
      Object.assign(existing, data, { lastSeen: new Date() });
    } else {
      this.workers.set(key, {
        hashrate: 0,
        validShares: 0,
        invalidShares: 0,
        difficulty: 1,
        lastSeen: new Date(),
        connectedAt: new Date(),
        ...data,
      });
    }
  }

  removeWorker(key: string): void {
    this.workers.delete(key);
  }

  incrementValid(key: string, difficulty: number): void {
    const w = this.workers.get(key);
    if (w) {
      w.validShares += 1;
      w.lastSeen = new Date();
      // Rough hashrate estimate: difficulty * 2^32 / interval
      w.hashrate = difficulty * DIFF1_HASHES / 10; // divide by ~10s window
    }
    this.totalValidShares += 1;
  }

  incrementInvalid(key: string): void {
    const w = this.workers.get(key);
    if (w) {
      w.invalidShares += 1;
    }
    this.totalInvalidShares += 1;
  }

  getActiveWorkers(): WorkerState[] {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000); // active in last 15 min
    return Array.from(this.workers.values()).filter(w => w.lastSeen > cutoff);
  }

  getPoolHashrate(): number {
    return this.getActiveWorkers().reduce((sum, w) => sum + w.hashrate, 0);
  }

  getStats() {
    const active = this.getActiveWorkers();
    const addresses = new Set(active.map(w => w.address));
    return {
      activeWorkers: active.length,
      activeMiners: addresses.size,
      poolHashrate: this.getPoolHashrate(),
    };
  }
}

export const poolState = new PoolState();
