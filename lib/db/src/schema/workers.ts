import { pgTable, text, serial, timestamp, real, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const workersTable = pgTable("workers", {
  id: serial("id").primaryKey(),
  address: text("address").notNull(),
  workerName: text("worker_name").notNull().default("default"),
  hashrate: real("hashrate").notNull().default(0),
  validShares: integer("valid_shares").notNull().default(0),
  invalidShares: integer("invalid_shares").notNull().default(0),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
  mode: text("mode").notNull().default("pplns"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  addressWorkerIdx: uniqueIndex("address_worker_idx").on(table.address, table.workerName),
}));

export const insertWorkerSchema = createInsertSchema(workersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWorker = z.infer<typeof insertWorkerSchema>;
export type Worker = typeof workersTable.$inferSelect;
