import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { logSchema } from "../schemas/log.schema.js";

export class LogRepository {
  constructor(private readonly db: NodePgDatabase) {}

  create(log: typeof logSchema.$inferInsert) {
    return this.db.insert(logSchema).values(log);
  }
}
