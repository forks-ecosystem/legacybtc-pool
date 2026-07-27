import { pgTable, text, serial, timestamp, real, boolean, integer, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const blocksTable = pgTable("blocks", {
  id: serial("id").primaryKey(),
  height: integer("height").notNull(),
  hash: text("hash").notNull().unique(),
  reward: bigint("reward", { mode: "number" }).notNull().default(0),
  finderAddress: text("finder_address").notNull(),
  foundAt: timestamp("found_at", { withTimezone: true }).notNull().defaultNow(),
  confirmed: boolean("confirmed").notNull().default(false),
  mode: text("mode").notNull().default("pplns"),
  devFee: bigint("dev_fee", { mode: "number" }).notNull().default(0),
  txid: text("txid"),
  submitResult: text("submit_result"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBlockSchema = createInsertSchema(blocksTable).omit({ id: true, createdAt: true });
export type InsertBlock = z.infer<typeof insertBlockSchema>;
export type Block = typeof blocksTable.$inferSelect;
