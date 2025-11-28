import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Session } from "../../../app/entities/Session.js";
import { sessionSchema } from "../schemas/session.schema.js";

export class SessionRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async create(session: Session) {
    await this.db.insert(sessionSchema).values(session);
  }
}
