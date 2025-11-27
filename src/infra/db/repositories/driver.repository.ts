import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { driverSchema } from "../schemas/driver.js";

export class DriverRepository {
  constructor(private readonly db: NodePgDatabase) {}

  create(drivers: (typeof driverSchema.$inferInsert)[]) {
    return this.db.insert(driverSchema).values(drivers);
  }
}
