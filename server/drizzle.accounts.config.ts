import { defineConfig } from 'drizzle-kit';

// Accounts only: their own schema and migrations, separate from the race tables in ./migrations.
export default defineConfig({
	schema: './src/accounts/db/schema.ts',
	out: './accounts-migrations',
	dialect: 'postgresql',
	schemaFilter: ['accounts']
});
