import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { logSchema } from '../schemas/log.schema.js';

export class LogRepository {
	private readonly db: NodePgDatabase;

	constructor(db: NodePgDatabase) {
		this.db = db;
	}

	create(log: typeof logSchema.$inferInsert) {
		return this.db.insert(logSchema).values(log);
	}
}
