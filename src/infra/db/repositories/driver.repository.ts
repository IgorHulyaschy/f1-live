import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { driverSchema } from "../schemas/driver.schema.js";

export class DriverRepository {
  constructor(private readonly db: NodePgDatabase) {}

  create(driver: (typeof driverSchema.$inferInsert)) {
    return this.db.insert(driverSchema).values(driver);
  }

  findAll() {
    return this.db.select().from(driverSchema);
  }
}
