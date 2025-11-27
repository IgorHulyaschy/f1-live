import { pgTable, text, varchar } from "drizzle-orm/pg-core";

export const driverSchema = pgTable("drivers", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  number: text("number").notNull(),
  team_id: varchar("team_id").notNull(),
  avatar_url: text("avatar_url"),
});
