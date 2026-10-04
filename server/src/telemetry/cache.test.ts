import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import { cachedStreamsDir, planEviction, readLedger, removeCached, writeLedger } from './cache.js';
import type { CachedSession } from './cache.js';
import { sessionTelemetryDir, telemetryDir } from './files.js';

const MB = 1e6;

function cached(key: number, megabytes: number, openedAt: string): CachedSession {
	return { key, path: `2019/meeting-${key}/race`, bytes: megabytes * MB, openedAt };
}

const AUSTRIA = cached(1, 30, '2026-10-01T10:00:00.000Z');

const BRITAIN = cached(2, 25, '2026-10-03T10:00:00.000Z');

const HUNGARY = cached(3, 20, '2026-10-02T10:00:00.000Z');

describe('planEviction', () => {
	it('evicts nothing while the cache fits its cap', () => {
		assert.deepEqual(planEviction([AUSTRIA, BRITAIN, HUNGARY], 75 * MB), {
			evict: [],
			overBytes: 0
		});
	});

	it('evicts the least recently opened first, only as many as the cap needs', () => {
		const plan = planEviction([BRITAIN, HUNGARY, AUSTRIA], 40 * MB);

		assert.deepEqual(
			plan.evict.map((session) => session.key),
			[1, 3]
		);
		assert.equal(plan.overBytes, 0);
		assert.deepEqual(
			planEviction([BRITAIN, HUNGARY, AUSTRIA], 50 * MB).evict.map((session) => session.key),
			[1]
		);
	});

	it('never evicts a kept session, and says how far over the cap that leaves the cache', () => {
		const plan = planEviction([AUSTRIA, BRITAIN, HUNGARY], 40 * MB, new Set([1, 2]));

		assert.deepEqual(
			plan.evict.map((session) => session.key),
			[3]
		);
		assert.equal(plan.overBytes, 15 * MB);
	});

	it('keeps a single session larger than the cap when it is kept', () => {
		assert.deepEqual(planEviction([AUSTRIA], 10 * MB, new Set([1])), {
			evict: [],
			overBytes: 20 * MB
		});
	});
});

describe('the cache ledger', () => {
	const dataDir = mkdtempSync(path.join(tmpdir(), 'cache-'));

	after(() => rmSync(dataDir, { recursive: true, force: true }));

	it('reads nothing from a new cache, and back what it wrote', async () => {
		assert.deepEqual(await readLedger(dataDir), []);

		await writeLedger(dataDir, [HUNGARY, AUSTRIA]);

		assert.deepEqual(await readLedger(dataDir), [AUSTRIA, HUNGARY]);
	});

	it('removes a session’s streams and telemetry, and keeps the circuit outlines', async () => {
		const streams = cachedStreamsDir(dataDir, AUSTRIA.path);
		const outline = path.join(telemetryDir(dataDir), 'circuits/19.json');

		mkdirSync(streams, { recursive: true });
		mkdirSync(sessionTelemetryDir(dataDir, 1), { recursive: true });
		mkdirSync(path.dirname(outline), { recursive: true });
		writeFileSync(path.join(streams, 'Position.z.jsonStream'), 'x');
		writeFileSync(path.join(sessionTelemetryDir(dataDir, 1), 'index.json'), '{}');
		writeFileSync(outline, '{}');

		await removeCached(dataDir, AUSTRIA);

		assert.equal(existsSync(streams), false);
		assert.equal(existsSync(sessionTelemetryDir(dataDir, 1)), false);
		assert.equal(existsSync(outline), true);
	});
});
