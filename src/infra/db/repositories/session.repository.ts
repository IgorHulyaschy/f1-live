import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { SessionType, Session } from "../../../app/entities/Session.js";
import { sessionSchema } from "../schemas/session.schema.js";

export class SessionRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async create(session: Session) {
    await this.db.insert(sessionSchema).values(session);
  }

  async findOneById(id: string) {
    const [first] = await this.db
      .select()
      .from(sessionSchema)
      .where(eq(sessionSchema.id, id))
      .limit(1);

    return first ?? null;
  }

  async findOne(name: string, type: SessionType) {
    const [first] = await this.db
      .select()
      .from(sessionSchema)
      .where(and(eq(sessionSchema.name, name), eq(sessionSchema.type, type)))
      .limit(1);

    return first ?? null;
  }
}
