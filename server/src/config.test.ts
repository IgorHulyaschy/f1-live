import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import { loadConfig } from './config.js';

describe('loadConfig', () => {
	it('starts with no environment at all, without a database', () => {
		const config = loadConfig({});

		assert.equal(config.mode, 'all');
		assert.equal(config.host, '127.0.0.1');
		assert.equal(config.port, 3000);
		assert.deepEqual(config.corsOrigins, ['http://localhost:5173', 'http://127.0.0.1:5173']);
		assert.equal(path.basename(config.dataDir), 'data');
		assert.equal(config.live.importOnFinish, true);
	});

	it('reads the cloud split from the environment', () => {
		const config = loadConfig({
			MODE: 'ingest',
			RELAY_URL: 'https://relay.example.com',
			RELAY_SECRET: 'sixteen-chars-min',
			CORS_ORIGINS: 'https://app.example.com, https://www.example.com',
			F1TV_TOKEN: ' abc.def-ghi ',
			IMPORT_ON_FINISH: 'false',
			LIVE_STALL_SECONDS: '45'
		});

		assert.equal(config.mode, 'ingest');
		assert.deepEqual(config.corsOrigins, ['https://app.example.com', 'https://www.example.com']);
		assert.equal(config.live.accessToken, 'abc.def-ghi');
		assert.equal(config.live.importOnFinish, false);
		assert.equal(config.live.stallMs, 45_000);
	});

	it('never allows every origin', () => {
		assert.throws(() => loadConfig({ CORS_ORIGINS: '*' }), /CORS_ORIGINS/);
		assert.throws(
			() => loadConfig({ CORS_ORIGINS: 'https://app.example.com/path' }),
			/CORS_ORIGINS/
		);
	});

	it('asks for what the mode needs', () => {
		assert.throws(() => loadConfig({ MODE: 'ingest' }), /RELAY_URL: is required when MODE=ingest/);
		assert.throws(() => loadConfig({ MODE: 'relay' }), /RELAY_SECRET: is required when MODE=relay/);
		assert.throws(() => loadConfig({ MODE: 'relay', RELAY_SECRET: 'short' }), /RELAY_SECRET/);
		assert.doesNotThrow(() => loadConfig({ MODE: 'relay', RELAY_SECRET: 'sixteen-chars-min' }));
	});

	it('lists every problem at once and never echoes the token', () => {
		assert.throws(
			() => loadConfig({ PORT: 'abc', MODE: 'sideways', F1TV_TOKEN: 'secret value;' }),
			(error: Error) =>
				/PORT/.test(error.message) &&
				/MODE/.test(error.message) &&
				/F1TV_TOKEN/.test(error.message) &&
				!error.message.includes('secret value')
		);
	});
});
