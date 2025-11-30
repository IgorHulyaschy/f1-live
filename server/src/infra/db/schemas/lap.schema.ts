import { integer, pgTable, text, varchar } from "drizzle-orm/pg-core";

export const lap = pgTable("lap", {
  id: varchar("id").primaryKey(),
  driverNumber: text("driver_number").notNull(),
  lapNumber: integer("lap_number").notNull(),
  sector1Time: integer("sector1_time"),
  sector2Time: integer("sector2_time"),
  sector3Time: integer("sector3_time"),
  time: integer("time"), // ms
  sessionId: varchar("session_id").notNull(),
});
