import { pgTable, text, varchar } from "drizzle-orm/pg-core";

export const teamSchema = pgTable("teams", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  logo_url: text("logo_url"),
});
