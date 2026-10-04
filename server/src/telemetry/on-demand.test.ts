import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import type { TelemetryFetchStatus } from '@f1-live/shared';
import { startTestArchive } from '@f1-live/shared/test-archive';
import type { TestArchive } from '@f1-live/shared/test-archive';

import { rawDirOf } from '../sinks/files.js';
import type { BuildOptions, TelemetryReport } from './build.js';
import { cachedStreamsDir, readLedger, writeLedger } from './cache.js';
import { sessionTelemetryDir } from './files.js';
import { TelemetryOnDemand, cacheSessionTelemetry, indexedSessions } from './on-demand.js';
import type { CacheSettings } from './on-demand.js';
import { prefetch, selectSessions } from './prefetch.js';

const GB = 1e9;

const FIXTURES = path.join(import.meta.dirname, '../sources/f1/fixtures/2018-austria-telemetry');

const RACE = { key: 5001, path: '2019/2019-06-30_Austrian_Grand_Prix/2019-06-30_Race' };

const QUALIFYING = { key: 5002, path: '2019/2019-06-30_Austrian_Grand_Prix/2019-06-29_Qualifying' };

const STORED = { key: 9001, path: '2025/2025-06-29_Austrian_Grand_Prix/2025-06-29_Race' };

function seasonIndex(year: number, sessions: readonly { key: number; path: string }[]): string {
	return JSON.stringify({
		Year: year,
		Meetings: [
			{
				Key: year,
				Name: 'Austrian Grand Prix',
				OfficialName: 'Austrian Grand Prix',
				Location: 'Spielberg',
				Country: { Code: 'AUT', Name: 'Austria' },
				Circuit: { ShortName: 'Spielberg' },
				Sessions: sessions.map((session, index) => ({
					Key: session.key,
					Type: 'Race',
					Name: `Session ${index + 1}`,
					StartDate: `${year}-06-30T15:10:00`,
					EndDate: `${year}-06-30T17:10:00`,
					GmtOffset: '02:00:00',
					Path: `${session.path}/`
				}))
			}
		]
	});
}

const STREAMS = new Map(
	['Position.z.jsonStream', 'CarData.z.jsonStream'].map((file) => [
		file,
		readFileSync(path.join(FIXTURES, file))
	])
);

function archiveFiles(...sessions: readonly { path: string }[]): Map<string, Buffer> {
	return new Map(
		sessions.flatMap((session) =>
			[...STREAMS].map(([file, bytes]) => [`${session.path}/${file}`, bytes] as const)
		)
	);
}

function builtReport(key: number): TelemetryReport {
	return {
		status: 'built',
		key,
		circuitKey: '19',
		outline: {
			reused: true,
			lengthM: 4318,
			points: 800,
			miniSectors: 24,
			miniSectorSource: 'timing',
			pitLane: true,
			latencyMs: 300
		},
		laps: {
			files: 1,
			partial: 0,
			offLength: 0,
			maxDeviation: { flying: 0, pit: 0 },
			totalBytes: 1,
			meanBytes: 1,
			maxBytes: 1
		},
		replay: { chunks: 1, totalBytes: 1 },
		hasCarData: true,
		skippedFrames: 0,
		elapsedMs: 1
	};
}

/** Writes a telemetry folder of `bytes` and remembers what it was asked to build from. */
function fakeBuild(bytes = 1000) {
	const calls: Omit<BuildOptions, 'log' | 'rebuildOutline'>[] = [];

	const build = async (options: Omit<BuildOptions, 'log' | 'rebuildOutline'>) => {
		calls.push(options);

		const folder = sessionTelemetryDir(options.dataDir, options.key);

		mkdirSync(folder, { recursive: true });
		writeFileSync(path.join(folder, 'index.json'), '{}');
		writeFileSync(path.join(folder, 'laps.json.gz'), Buffer.alloc(bytes));

		return builtReport(options.key);
	};

	return { calls, build };
}

let dataDir: string;

let archive: TestArchive;

beforeEach(() => {
	dataDir = mkdtempSync(path.join(tmpdir(), 'on-demand-'));

	const rawDir = rawDirOf(dataDir);

	for (const [year, sessions] of [
		[2019, [RACE, QUALIFYING]],
		[2025, [STORED]]
	] as const) {
		mkdirSync(path.join(rawDir, String(year)), { recursive: true });
		writeFileSync(path.join(rawDir, `${year}/Index.json`), seasonIndex(year, sessions));

		for (const session of sessions) {
			mkdirSync(path.join(rawDir, session.path), { recursive: true });
			writeFileSync(path.join(rawDir, session.path, 'SessionInfo.jsonStream'), '﻿');
		}
	}
});

afterEach(async () => {
	await archive.close();
	rmSync(dataDir, { recursive: true, force: true });
});

function settings(overrides: Partial<CacheSettings> = {}): CacheSettings {
	return {
		dataDir,
		archiveUrl: archive.url,
		capBytes: 5 * GB,
		floorBytes: 10 * GB,
		freeBytes: async () => 50 * GB,
		build: fakeBuild().build,
		now: () => new Date('2026-10-04T12:00:00Z'),
		...overrides
	};
}

describe('TelemetryOnDemand', () => {
	it('fetches the positions and car data as the archive has them, builds from them and caches the session', async () => {
		archive = await startTestArchive(archiveFiles(RACE));

		const { calls, build } = fakeBuild();
		const onDemand = new TelemetryOnDemand(settings({ build }), () => undefined);

		assert.deepEqual(await onDemand.status(RACE.key), { state: 'idle' });
		assert.deepEqual(await onDemand.request(RACE.key), { state: 'queued', ahead: 0 });
		await onDemand.idle();

		assert.deepEqual(await onDemand.status(RACE.key), { state: 'ready' });

		const streams = cachedStreamsDir(dataDir, RACE.path);

		for (const [file, bytes] of STREAMS) {
			assert.deepEqual(readFileSync(path.join(streams, file)), bytes);
		}

		assert.deepEqual(calls, [
			{
				rawDir: path.join(rawDirOf(dataDir), RACE.path),
				streamsDir: streams,
				key: RACE.key,
				dataDir
			}
		]);

		const [entry] = await readLedger(dataDir);

		assert.equal(entry?.key, RACE.key);
		assert.equal(entry?.path, RACE.path);
		assert.equal(entry?.openedAt, '2026-10-04T12:00:00.000Z');
		assert.ok((entry?.bytes ?? 0) > 6000, `${entry?.bytes} bytes`);

		// Ready now: asking again fetches nothing.
		assert.deepEqual(await onDemand.request(RACE.key), { state: 'ready' });
		assert.equal(archive.requests.length, 2);
	});

	it('reports the bytes as they arrive, and queues a second session behind the first', async () => {
		archive = await startTestArchive(archiveFiles(RACE, QUALIFYING));
		archive.hold();

		const onDemand = new TelemetryOnDemand(settings(), () => undefined);

		await onDemand.request(RACE.key);
		assert.deepEqual(await onDemand.request(QUALIFYING.key), { state: 'queued', ahead: 0 });

		while (archive.requests.length < 2) {
			await new Promise((resolve) => setTimeout(resolve, 5));
		}

		assert.deepEqual(await onDemand.status(RACE.key), {
			state: 'fetching',
			receivedBytes: 0,
			totalBytes: null
		});
		archive.release();
		await onDemand.idle();

		assert.deepEqual(await onDemand.status(RACE.key), { state: 'ready' });
		assert.deepEqual(await onDemand.status(QUALIFYING.key), { state: 'ready' });
	});

	it('passes through fetching with a known total and building before it is ready', async () => {
		archive = await startTestArchive(archiveFiles(RACE));

		const seen: TelemetryFetchStatus[] = [];
		const total = [...STREAMS.values()].reduce((sum, bytes) => sum + bytes.length, 0);

		await cacheSessionTelemetry(
			{ ...RACE, type: 'race', name: 'Race', startsAt: '', endsAt: '' },
			settings(),
			{
				onStatus: (status) => seen.push(status)
			}
		);

		assert.deepEqual(seen.at(-1), { state: 'building' });
		assert.deepEqual(seen.at(-2), { state: 'fetching', receivedBytes: total, totalBytes: total });
		assert.ok(
			seen.some(
				(status) =>
					status.state === 'fetching' && status.receivedBytes === 0 && status.totalBytes === total
			)
		);
	});

	it('evicts the least recently opened sessions over the cap, never the one it just built', async () => {
		archive = await startTestArchive(archiveFiles(RACE));

		const older = [
			{ key: 4001, path: '2018/a/race', bytes: 3 * GB, openedAt: '2026-10-01T00:00:00.000Z' },
			{ key: 4002, path: '2018/b/race', bytes: 1.5 * GB, openedAt: '2026-10-03T00:00:00.000Z' },
			{ key: 4003, path: '2018/c/race', bytes: 1 * GB, openedAt: '2026-10-02T00:00:00.000Z' }
		];

		for (const session of older) {
			mkdirSync(cachedStreamsDir(dataDir, session.path), { recursive: true });
			mkdirSync(sessionTelemetryDir(dataDir, session.key), { recursive: true });
			writeFileSync(path.join(sessionTelemetryDir(dataDir, session.key), 'index.json'), '{}');
		}

		await writeLedger(dataDir, older);

		const onDemand = new TelemetryOnDemand(settings({ capBytes: 2 * GB }), () => undefined);

		await onDemand.request(RACE.key);
		await onDemand.idle();

		assert.deepEqual(
			(await readLedger(dataDir)).map((session) => session.key),
			[4002, RACE.key]
		);
		assert.equal(existsSync(cachedStreamsDir(dataDir, '2018/a/race')), false);
		assert.equal(existsSync(sessionTelemetryDir(dataDir, 4003)), false);
		assert.equal(existsSync(sessionTelemetryDir(dataDir, 4002)), true);
		assert.deepEqual(await onDemand.status(4001), { state: 'idle' });
	});

	it('keeps a reopened session longest', async () => {
		archive = await startTestArchive(archiveFiles(RACE));

		let clock = new Date('2026-10-04T12:00:00Z');

		const older = [
			{ key: 4001, path: '2018/a/race', bytes: 2 * GB, openedAt: '2026-10-01T00:00:00.000Z' },
			{ key: 4002, path: '2018/b/race', bytes: 2 * GB, openedAt: '2026-10-02T00:00:00.000Z' }
		];

		await writeLedger(dataDir, older);

		const onDemand = new TelemetryOnDemand(
			settings({ capBytes: 3 * GB, now: () => clock }),
			() => undefined
		);

		await onDemand.opened(4001);
		clock = new Date('2026-10-04T13:00:00Z');
		await onDemand.opened(STORED.key);
		await onDemand.request(RACE.key);
		await onDemand.idle();

		assert.deepEqual(
			(await readLedger(dataDir)).map((session) => [session.key, session.openedAt]),
			[
				[4001, '2026-10-04T12:00:00.000Z'],
				[RACE.key, '2026-10-04T13:00:00.000Z']
			]
		);
	});

	it('stops before writing a byte when the download would leave less than the floor free', async () => {
		archive = await startTestArchive(archiveFiles(RACE));

		const { calls, build } = fakeBuild();

		const onDemand = new TelemetryOnDemand(
			settings({ build, freeBytes: async () => 10 * GB + 1000 }),
			() => undefined
		);

		await onDemand.request(RACE.key);
		await onDemand.idle();

		const status = await onDemand.status(RACE.key);

		assert.equal(status.state, 'failed');
		assert.match(
			status.state === 'failed' ? status.message : '',
			/^Not fetched: 10\.0 GB free and 0\.0 GB needed, below the 10 GB floor\.$/
		);
		assert.equal(existsSync(cachedStreamsDir(dataDir, RACE.path)), false);
		assert.equal(calls.length, 0);
	});

	it('says when the archive holds no positions for the session, and asks only once', async () => {
		archive = await startTestArchive(new Map());

		const onDemand = new TelemetryOnDemand(settings(), () => undefined);

		await onDemand.request(RACE.key);
		await onDemand.idle();

		const unavailable = {
			state: 'unavailable',
			reason: 'The archive holds no car positions for this session.'
		};

		assert.deepEqual(await onDemand.status(RACE.key), unavailable);
		assert.deepEqual(await onDemand.request(RACE.key), unavailable);
		assert.equal(archive.requests.length, 2);
		assert.deepEqual(await readLedger(dataDir), []);
	});

	it('fetches nothing for a stored season, an unknown key or a session not imported', async () => {
		archive = await startTestArchive(archiveFiles(RACE, STORED));
		rmSync(path.join(rawDirOf(dataDir), QUALIFYING.path), { recursive: true });

		const onDemand = new TelemetryOnDemand(settings(), () => undefined);

		assert.deepEqual(await onDemand.request(STORED.key), {
			state: 'unavailable',
			reason: 'This session was stored without car positions.'
		});
		assert.deepEqual(await onDemand.request(1), {
			state: 'unavailable',
			reason: 'No imported session has this key.'
		});
		assert.deepEqual(await onDemand.request(QUALIFYING.key), {
			state: 'unavailable',
			reason: 'This session is not imported yet.'
		});
		assert.deepEqual(archive.requests, []);
	});

	it('builds from the raw folder alone when it already holds the positions', async () => {
		archive = await startTestArchive(new Map());

		const rawRace = path.join(rawDirOf(dataDir), RACE.path);

		writeFileSync(
			path.join(rawRace, 'Position.z.jsonStream'),
			STREAMS.get('Position.z.jsonStream') ?? ''
		);

		const { calls, build } = fakeBuild();
		const onDemand = new TelemetryOnDemand(settings({ build }), () => undefined);

		await onDemand.request(RACE.key);
		await onDemand.idle();

		assert.deepEqual(archive.requests, []);
		assert.equal(calls[0]?.streamsDir, undefined);
		assert.deepEqual(await onDemand.status(RACE.key), { state: 'ready' });
	});

	it('tries a failed session again when asked', async () => {
		archive = await startTestArchive(archiveFiles(RACE));

		let failures = 1;
		const { build } = fakeBuild();

		const onDemand = new TelemetryOnDemand(
			settings({
				build: async (options) => {
					if (failures > 0) {
						failures -= 1;
						throw new Error('worker ran out of memory');
					}

					return build(options);
				}
			}),
			() => undefined
		);

		await onDemand.request(RACE.key);
		await onDemand.idle();
		assert.deepEqual(await onDemand.status(RACE.key), {
			state: 'failed',
			message: 'worker ran out of memory'
		});

		await onDemand.request(RACE.key);
		await onDemand.idle();
		assert.deepEqual(await onDemand.status(RACE.key), { state: 'ready' });
		// The streams were kept: the second try asked the archive for nothing.
		assert.equal(archive.requests.length, 2);
	});

	it('counts the streams a failed session left, so eviction can reclaim them', async () => {
		archive = await startTestArchive(archiveFiles(RACE));

		const onDemand = new TelemetryOnDemand(
			settings({
				build: async () => {
					throw new Error('worker ran out of memory');
				}
			}),
			() => undefined
		);

		await onDemand.request(RACE.key);
		await onDemand.idle();

		const [entry] = await readLedger(dataDir);

		assert.equal(entry?.key, RACE.key);
		assert.ok((entry?.bytes ?? 0) > 0);
	});

	it('queues a session once when two viewers ask at the same moment', async () => {
		archive = await startTestArchive(archiveFiles(RACE));

		const { calls, build } = fakeBuild();
		const onDemand = new TelemetryOnDemand(settings({ build }), () => undefined);

		await Promise.all([onDemand.request(RACE.key), onDemand.request(RACE.key)]);
		await onDemand.idle();

		assert.equal(calls.length, 1);
		assert.equal(archive.requests.length, 2);
	});

	it('runs the sessions queued behind one whose ledger write failed', async () => {
		archive = await startTestArchive(archiveFiles(RACE, QUALIFYING));
		mkdirSync(path.join(dataDir, 'cache'), { recursive: true });
		writeFileSync(path.join(dataDir, 'cache/sessions.json'), 'not json');

		const onDemand = new TelemetryOnDemand(settings(), () => undefined);

		await onDemand.request(RACE.key);
		await onDemand.idle();
		assert.equal((await onDemand.status(RACE.key)).state, 'failed');

		rmSync(path.join(dataDir, 'cache/sessions.json'));
		await onDemand.request(QUALIFYING.key);
		await onDemand.idle();
		assert.deepEqual(await onDemand.status(QUALIFYING.key), { state: 'ready' });
	});

	it('never evicts a session a viewer opened in the last hours for another one', async () => {
		archive = await startTestArchive(archiveFiles(RACE));

		const watched = {
			key: 4001,
			path: '2018/a/race',
			bytes: 4 * GB,
			openedAt: '2026-10-01T00:00:00.000Z'
		};

		await writeLedger(dataDir, [watched]);

		let clock = new Date('2026-10-04T10:00:00Z');

		const onDemand = new TelemetryOnDemand(
			settings({ capBytes: 2 * GB, now: () => clock }),
			() => undefined
		);

		await onDemand.opened(watched.key);
		clock = new Date('2026-10-04T12:00:00Z');
		await onDemand.request(RACE.key);
		await onDemand.idle();

		assert.deepEqual(
			(await readLedger(dataDir)).map((session) => session.key),
			[watched.key, RACE.key]
		);
	});
});

describe('prefetch', () => {
	it('selects a season by year, type and key, oldest first', async () => {
		archive = await startTestArchive(new Map());

		const sessions = (await indexedSessions(dataDir)).values();
		const all = [...sessions];

		assert.deepEqual(
			selectSessions(all, { year: 2019 }).map((session) => session.key),
			[RACE.key, QUALIFYING.key]
		);
		assert.deepEqual(
			selectSessions(all, { keys: [STORED.key] }).map((session) => session.key),
			[STORED.key]
		);
		assert.deepEqual(selectSessions(all, { year: 2019, types: ['qualifying'] }), []);
	});

	it('stops at the cap rather than evict a session it fetched, and backs the last one out', async () => {
		archive = await startTestArchive(archiveFiles(RACE, QUALIFYING));

		const sessions = [...(await indexedSessions(dataDir)).values()];

		const result = await prefetch(
			selectSessions(sessions, { year: 2019 }),
			settings({ build: fakeBuild(1e6).build, capBytes: 1.5e6 })
		);

		assert.deepEqual(
			result.lines.map((line) => [line.key, line.state]),
			[[RACE.key, 'ready']]
		);
		assert.match(result.stopped ?? '', /^Cache cap reached at 2019\/.*Qualifying/);
		assert.deepEqual(
			(await readLedger(dataDir)).map((session) => session.key),
			[RACE.key]
		);
		assert.equal(existsSync(cachedStreamsDir(dataDir, QUALIFYING.path)), false);
		assert.equal(existsSync(sessionTelemetryDir(dataDir, QUALIFYING.key)), false);
	});

	it('keeps the sessions an earlier run cached without building them again', async () => {
		archive = await startTestArchive(archiveFiles(RACE, QUALIFYING));

		const sessions = selectSessions([...(await indexedSessions(dataDir)).values()], { year: 2019 });
		const { calls, build } = fakeBuild();

		await prefetch(sessions, settings({ build }));

		const again = await prefetch(sessions, settings({ build }));

		assert.equal(calls.length, 2);
		assert.deepEqual(
			again.lines.map((line) => [line.state, line.detail]),
			[
				['ready', 'already cached'],
				['ready', 'already cached']
			]
		);
	});

	it('stops at the disk floor before the sessions after it', async () => {
		archive = await startTestArchive(archiveFiles(RACE));

		const sessions = [...(await indexedSessions(dataDir)).values()];

		const result = await prefetch(
			selectSessions(sessions, { keys: [STORED.key, RACE.key, QUALIFYING.key] }),
			settings({ freeBytes: async () => 10 * GB })
		);

		assert.deepEqual(
			result.lines.map((line) => [line.key, line.state]),
			[[RACE.key, 'failed']]
		);
		assert.match(result.stopped ?? '', /below the 10 GB floor/);
	});
});
