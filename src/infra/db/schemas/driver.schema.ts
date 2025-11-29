import { pgTable, text, varchar } from "drizzle-orm/pg-core";

export const driverSchema = pgTable("drivers", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  number: text("number").notNull().unique(),
  team: varchar("team").notNull(),
  avatarUrl: text("avatar_url"),
});
