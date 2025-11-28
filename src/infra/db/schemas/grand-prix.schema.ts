import { pgTable, text, varchar } from "drizzle-orm/pg-core";

export const grandPrixSchema = pgTable("grand_prix", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  year: text("year").notNull(),
});
