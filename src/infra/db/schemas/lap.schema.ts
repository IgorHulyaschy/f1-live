import { integer, pgTable, text, varchar } from "drizzle-orm/pg-core";

export const lap = pgTable("lap", {
  id: varchar("id").primaryKey(),
  driverId: varchar("driver_id").notNull(),
  time: text("time").notNull(),
  lapNumber: integer("lap_number").notNull(),
  grandPrixId: varchar("grand_prix_id").notNull(),
});