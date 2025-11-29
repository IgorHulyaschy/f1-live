import { pgTable, varchar } from "drizzle-orm/pg-core";

import type { SessionType } from "../../../app/entities/Session.js";

export const sessionSchema = pgTable("sessions", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  country: varchar("country").notNull(),
  type: varchar("type").$type<SessionType>().notNull(),
  date: varchar("date").notNull(),
});
