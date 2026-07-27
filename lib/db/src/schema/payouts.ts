import { pgTable, text, serial, timestamp, bigint, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const payoutsTable = pgTable("payouts", {
  id: serial("id").primaryKey(),
  address: text("address").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  txid: text("txid"),
  blockId: integer("block_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPayoutSchema = createInsertSchema(payoutsTable).omit({ id: true, createdAt: true });
export type InsertPayout = z.infer<typeof insertPayoutSchema>;
export type Payout = typeof payoutsTable.$inferSelect;
