import { pgTable, text, serial, timestamp, real, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sharesTable = pgTable("shares", {
  id: serial("id").primaryKey(),
  workerAddress: text("worker_address").notNull(),
  workerName: text("worker_name").notNull().default("default"),
  jobId: text("job_id").notNull(),
  nonce: text("nonce").notNull(),
  difficulty: real("difficulty").notNull().default(1),
  valid: boolean("valid").notNull().default(true),
  blockHeight: integer("block_height"),
  mode: text("mode").notNull().default("pplns"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertShareSchema = createInsertSchema(sharesTable).omit({ id: true, createdAt: true });
export type InsertShare = z.infer<typeof insertShareSchema>;
export type Share = typeof sharesTable.$inferSelect;
