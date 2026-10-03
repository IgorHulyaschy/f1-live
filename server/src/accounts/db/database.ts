import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres';
import { migrate as migratePostgres } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { Pool } from 'pg';

import type { AccountsConfig } from '../config.js';
import * as schema from './schema.js';

export type AccountsDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

export type OpenDatabase = { db: AccountsDatabase; close: () => Promise<void> };

/**
 * The same migrations run on PGlite and on Postgres; src and dist sit at the same depth. Their
 * journal has its own table, apart from any other drizzle migrations in the database.
 */
const MIGRATIONS = {
	migrationsFolder: fileURLToPath(new URL('../../../accounts-migrations', import.meta.url)),
	migrationsTable: '__accounts_migrations'
};

/**
 * Postgres when DATABASE_URL is set, otherwise PGlite: Postgres compiled to WebAssembly and run
 * in-process, on disk for development or in memory for tests. Migrations run before it returns.
 */
export async function openDatabase(database: AccountsConfig['database']): Promise<OpenDatabase> {
	if (database.kind === 'postgres') {
		const pool = new Pool({ connectionString: database.url });
		const db = drizzlePostgres(pool, { schema });

		await migratePostgres(db, MIGRATIONS);

		return { db, close: () => pool.end() };
	}

	if (database.dataDir) {
		mkdirSync(database.dataDir, { recursive: true });
	}

	const client = new PGlite(database.dataDir ?? 'memory://');
	const db = drizzlePglite(client, { schema });

	await migratePglite(db, MIGRATIONS);

	return { db, close: () => client.close() };
}
