import {
  jsonb,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const logSchema = pgTable("logs", {
  id: serial("id").primaryKey(),
  topic: varchar("topic").notNull(),
  eventData: jsonb("event_data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: false })
    .notNull()
    .defaultNow(),
});
