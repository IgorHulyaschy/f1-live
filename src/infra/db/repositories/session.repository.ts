import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { SessionType } from "../../../app/entities/Session.js";
import { type Session } from "../../../app/entities/Session.js";
import { sessionSchema } from "../schemas/session.schema.js";
import { and, eq } from "drizzle-orm";

export class SessionRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async create(session: Session) {
    await this.db.insert(sessionSchema).values(session);
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
