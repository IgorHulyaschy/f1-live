import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseImportArguments } from './args.js';

describe('parseImportArguments', () => {
	it('reads a season and a meeting name made of several words', () => {
		const { selection } = parseImportArguments(['2025', 'Las', 'Vegas'], {});

		assert.deepEqual(selection, { kind: 'meeting', years: [2025], meeting: 'Las Vegas' });
	});

	it('reads several seasons joined by commas', () => {
		const { selection } = parseImportArguments(['2025,2026'], {});

		assert.deepEqual(selection, { kind: 'meeting', years: [2025, 2026] });
	});

	it('reads --key and --from-dir with an optional key', () => {
		assert.deepEqual(parseImportArguments(['--key', '9858'], {}).selection, {
			kind: 'key',
			key: 9858
		});
		assert.deepEqual(parseImportArguments(['--from-dir', '/raw'], {}).selection, {
			kind: 'fromDir',
			root: '/raw'
		});
		assert.deepEqual(parseImportArguments(['--from-dir', '/raw', '--key', '11729'], {}).selection, {
			kind: 'fromDir',
			root: '/raw',
			key: 11729
		});
	});

	it('takes the data directory from --data-dir, then DATA_DIR, then the default', () => {
		assert.equal(
			parseImportArguments(['2025', '--data-dir', '/a'], { DATA_DIR: '/b' }).dataDir,
			'/a'
		);
		assert.equal(parseImportArguments(['2025'], { DATA_DIR: '/b' }).dataDir, '/b');
		assert.match(parseImportArguments(['2025'], {}).dataDir, /\/data$/);
	});

	it('reads --offline and --now', () => {
		const args = parseImportArguments(['2025', '--offline', '--now', '2026-10-03T12:00:00Z'], {});

		assert.equal(args.offline, true);
		assert.equal(args.now.toISOString(), '2026-10-03T12:00:00.000Z');
	});

	it('builds telemetry unless --no-telemetry says not to', () => {
		assert.equal(parseImportArguments(['2025'], {}).telemetry, true);
		assert.equal(parseImportArguments(['2025', '--no-telemetry'], {}).telemetry, false);
	});

	it('throws the usage when nothing says what to import, or a value is malformed', () => {
		assert.throws(() => parseImportArguments([], {}), /Usage/);
		assert.throws(() => parseImportArguments(['Las Vegas'], {}), /Usage/);
		assert.throws(() => parseImportArguments(['--key', 'abc'], {}), /whole number/);
		assert.throws(() => parseImportArguments(['2025', '--now', 'soon'], {}), /ISO time/);
	});
});
