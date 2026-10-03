import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import { loadConfig } from '../config.js';

describe('accounts settings', () => {
	it('stay off until a database is chosen', () => {
		assert.equal(loadConfig({}).accounts, null);
	});

	it('need nothing else in development: PGlite under DATA_DIR, printed links, fake payments', () => {
		const accounts = loadConfig({ ACCOUNTS_DB: 'pglite', DATA_DIR: '/tmp/pitwall' }).accounts;

		assert.deepEqual(accounts?.database, {
			kind: 'pglite',
			dataDir: path.join('/tmp/pitwall', 'accounts', 'pglite')
		});
		assert.equal(accounts?.mail.smtpUrl, null);
		assert.equal(accounts?.payments.kind, 'fake');
		assert.equal(accounts?.appUrl, 'http://localhost:5173');
		assert.deepEqual(accounts?.trustedOrigins, ['http://localhost:5173', 'http://127.0.0.1:5173']);
		assert.equal(accounts?.social.google, null);
	});

	it('use Postgres whenever DATABASE_URL is set', () => {
		const accounts = loadConfig({ DATABASE_URL: 'postgres://db.example/accounts' }).accounts;

		assert.deepEqual(accounts?.database, {
			kind: 'postgres',
			url: 'postgres://db.example/accounts'
		});
	});

	it('turn a sign-in provider on only with both of its keys', () => {
		assert.throws(
			() => loadConfig({ ACCOUNTS_DB: 'memory', GOOGLE_CLIENT_ID: 'id-only' }),
			/GOOGLE_CLIENT_SECRET/
		);
	});

	it('refuse development stand-ins in production, listing every missing value', () => {
		assert.throws(
			() => loadConfig({ NODE_ENV: 'production', ACCOUNTS_DB: 'pglite' }),
			(error: Error) =>
				[
					'BETTER_AUTH_SECRET',
					'ACCOUNTS_DB',
					'SMTP_URL',
					'STRIPE_SECRET_KEY',
					'STRIPE_PRICE_PRO_YEARLY',
					'ACCOUNTS_PUBLIC_URL'
				].every((name) => error.message.includes(name))
		);
		assert.throws(
			() =>
				loadConfig({
					NODE_ENV: 'production',
					DATABASE_URL: 'postgres://db.example/accounts',
					PAYMENTS_PROVIDER: 'fake'
				}),
			/PAYMENTS_PROVIDER/
		);
	});
});
