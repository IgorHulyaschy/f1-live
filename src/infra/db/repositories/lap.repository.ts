import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { Lap } from "../../../app/entities/Lap.js";
import { lap } from "../schemas/lap.schema.js";

export class LapRepository {
  constructor(private readonly db: NodePgDatabase) {}

  create(lapEntity: Lap) {
    return this.db.insert(lap).values({
      ...lapEntity,
      sector1Time: lapEntity.sector1Time ?? 0,
      sector2Time: lapEntity.sector2Time || null,
      sector3Time: lapEntity.sector3Time || null,
      time: lapEntity.time || null,
    });
  }

  async findLastLap(driverNumber: string, sessionId: string) {
    const [first] = await this.db
      .select()
      .from(lap)
      .where(
        and(eq(lap.driverNumber, driverNumber), eq(lap.sessionId, sessionId)),
      )
      .orderBy(desc(lap.lapNumber))
      .limit(1);

    return first ? new Lap(first) : null;
  }

  async update(lapEntity: Lap) {
    await this.db
      .update(lap)
      .set({
        sector1Time: lapEntity.sector1Time,
        sector2Time: lapEntity.sector2Time,
        sector3Time: lapEntity.sector3Time,
        time: lapEntity.time ?? undefined,
      })
      .where(and(eq(lap.id, lapEntity.id)));
  }

  findAllByDriverNumber(driverNumber: string, sessionId: string) {
    return this.db
      .select()
      .from(lap)
      .where(
        and(eq(lap.driverNumber, driverNumber), eq(lap.sessionId, sessionId)),
      );
  }
}
