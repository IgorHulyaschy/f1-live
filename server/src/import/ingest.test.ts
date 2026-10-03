import assert from 'node:assert/strict';
import {
	appendFileSync,
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { gunzipSync } from 'node:zlib';

import type { RaceEvent, RaceSnapshot } from '@f1-live/shared';

import { errorsPathOf, eventsPathOf, snapshotPathOf } from '../sinks/files.js';
import { sessionTelemetryDir } from '../telemetry/files.js';
import type { CorrectionSource } from './corrections.js';
import { ingestSession } from './ingest.js';

/** A trimmed copy of the 2025 Las Vegas race (key 9858): four drivers, every topic the decoder reads. */
const FIXTURE = path.join(import.meta.dirname, '../sources/f1/fixtures/2025-las-vegas-race');

/** Ten seconds of Position.z and CarData.z of the same race: telemetry without a lap to build from. */
const TELEMETRY_FIXTURE = path.join(
	import.meta.dirname,
	'../sources/f1/fixtures/2025-las-vegas-telemetry'
);

const roots: string[] = [];

after(() => {
	for (const root of roots) {
		rmSync(root, { recursive: true, force: true });
	}
});

function newRoot(): string {
	const root = mkdtempSync(path.join(tmpdir(), 'ingest-'));

	roots.push(root);

	return root;
}

const disqualifyLeader: CorrectionSource = {
	load: () =>
		Promise.resolve([
			{
				kind: 'classification_correction',
				at: '2025-11-23T12:00:00.000Z',
				correction: { driverNumber: '1', kind: 'disqualified', reason: 'test decision' }
			}
		])
};

function readEvents(dataDir: string): RaceEvent[] {
	return gunzipSync(readFileSync(eventsPathOf(dataDir, 9858)))
		.toString('utf8')
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line));
}

function readSnapshot(dataDir: string): RaceSnapshot {
	return JSON.parse(gunzipSync(readFileSync(snapshotPathOf(dataDir, 9858))).toString('utf8'));
}

/** Leaves a session's telemetry folder behind, as an earlier build would; returns its manifest. */
function leaveTelemetry(dataDir: string): string {
	const index = path.join(sessionTelemetryDir(dataDir, 9858), 'index.json');

	mkdirSync(path.dirname(index), { recursive: true });
	writeFileSync(index, '{}');

	return index;
}

describe('ingestSession', () => {
	it('writes the events and the snapshot of a session, with its corrections after its own events', async () => {
		const dataDir = newRoot();

		const result = await ingestSession({
			rawDir: FIXTURE,
			key: 9858,
			dataDir,
			corrections: [disqualifyLeader]
		});

		const events = readEvents(dataDir);

		assert.equal(result.events, events.length);
		assert.equal(result.corrections, 1);
		assert.equal(events.at(-1)?.kind, 'classification_correction');
		assert.equal(
			events.slice(0, -1).some((event) => event.kind === 'classification_correction'),
			false
		);

		const leader = readSnapshot(dataDir).standings?.find(
			(standing) => standing.driverNumber === '1'
		);

		assert.equal(leader?.disqualified, true);
		assert.equal(readSnapshot(dataDir).corrections?.[0]?.reason, 'test decision');
	});

	it('gives byte-identical outputs for the same raw files', async () => {
		const first = newRoot();
		const second = newRoot();

		for (const dataDir of [first, second]) {
			await ingestSession({ rawDir: FIXTURE, key: 9858, dataDir, corrections: [disqualifyLeader] });
		}

		for (const file of [eventsPathOf, snapshotPathOf]) {
			assert.deepEqual(readFileSync(file(first, 9858)), readFileSync(file(second, 9858)));
		}
	});

	it('reports a topic that fails to decode and still decodes the rest of the session', async () => {
		const dataDir = newRoot();
		const rawDir = path.join(newRoot(), 'session');

		cpSync(FIXTURE, rawDir, { recursive: true });
		appendFileSync(path.join(rawDir, 'TimingData.jsonStream'), '00:59:59.000{"Lines":5}\n');

		const clean = await ingestSession({
			rawDir: FIXTURE,
			key: 9858,
			dataDir: newRoot(),
			corrections: []
		});

		const result = await ingestSession({ rawDir, key: 9858, dataDir, corrections: [] });

		assert.equal(result.events, clean.events);
		assert.deepEqual(
			result.failures.map((failure) => [failure.topic, failure.frames]),
			[['TimingData', 1]]
		);

		const report = JSON.parse(readFileSync(errorsPathOf(dataDir, 9858), 'utf8'));

		assert.equal(report.key, 9858);
		assert.equal(report.frames, 1);
		assert.equal(report.topics[0].topic, 'TimingData');
		assert.ok(report.topics[0].samples[0].message.length > 0);
	});

	it('removes the error report of an earlier run once the session decodes cleanly', async () => {
		const dataDir = newRoot();
		const rawDir = path.join(newRoot(), 'session');

		cpSync(FIXTURE, rawDir, { recursive: true });
		appendFileSync(path.join(rawDir, 'TimingData.jsonStream'), '00:59:59.000{"Lines":5}\n');
		await ingestSession({ rawDir, key: 9858, dataDir, corrections: [] });
		assert.equal(existsSync(errorsPathOf(dataDir, 9858)), true);

		await ingestSession({ rawDir: FIXTURE, key: 9858, dataDir, corrections: [] });
		assert.equal(existsSync(errorsPathOf(dataDir, 9858)), false);
	});

	it('rejects a folder without any stream, for the batch to report', async () => {
		await assert.rejects(
			ingestSession({ rawDir: newRoot(), key: 1, dataDir: newRoot(), corrections: [] })
		);
	});

	describe('telemetry', () => {
		it('skips a session without Position.z and removes the folder an earlier build left', async () => {
			const dataDir = newRoot();
			const index = leaveTelemetry(dataDir);

			const result = await ingestSession({ rawDir: FIXTURE, key: 9858, dataDir, corrections: [] });

			assert.equal(result.telemetry.status, 'skipped');
			assert.equal(existsSync(index), false);
		});

		it('leaves telemetry alone when it is turned off', async () => {
			const dataDir = newRoot();
			const index = leaveTelemetry(dataDir);

			const result = await ingestSession({
				rawDir: FIXTURE,
				key: 9858,
				dataDir,
				corrections: [],
				telemetry: false
			});

			assert.deepEqual(result.telemetry, { status: 'off' });
			assert.equal(existsSync(index), true);
		});

		it('writes the events and the snapshot when the telemetry cannot be built, and keeps what was built before', async () => {
			const dataDir = newRoot();
			const rawDir = path.join(newRoot(), 'session');
			const index = leaveTelemetry(dataDir);

			cpSync(FIXTURE, rawDir, { recursive: true });
			cpSync(TELEMETRY_FIXTURE, rawDir, { recursive: true });

			const result = await ingestSession({ rawDir, key: 9858, dataDir, corrections: [] });

			assert.equal(result.telemetry.status, 'failed');
			assert.ok(result.events > 0);
			assert.equal(readSnapshot(dataDir).session.id, '9858');
			assert.equal(existsSync(index), true);
		});
	});
});
