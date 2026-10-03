import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import { SessionImporter } from './importer.js';
import type { Recording } from './importer.js';
import { loadReplayFrames } from './replay.js';
import {
	FIXTURE_DIR,
	reduceDirectly,
	startPlayback,
	tempDir,
	untilQuiet,
	waitUntil
} from './test-harness.js';
import type { Playback } from './test-harness.js';

const noLog = () => undefined;

const RECORDING: Recording = { key: 9858, dir: '/data/raw/2025/x/y' };

describe('SessionImporter', () => {
	it('runs the import once, after the delay, however many end statuses arrive', async () => {
		const runs: Recording[] = [];

		const importer = new SessionImporter({
			delayMs: 30,
			log: noLog,
			runner: (recording) => {
				runs.push(recording);

				return Promise.resolve();
			},
			cliExists: () => Promise.resolve(true)
		});

		importer.sessionEnded(RECORDING);
		importer.sessionEnded(RECORDING);
		importer.sessionEnded(RECORDING);
		assert.equal(runs.length, 0);
		await waitUntil(() => runs.length > 0, 'the import');
		await importer.close();
		assert.deepEqual(runs, [RECORDING]);
	});

	it('logs and skips when the import command does not exist yet', async () => {
		const events: string[] = [];

		const importer = new SessionImporter({
			delayMs: 0,
			log: (event) => events.push(event),
			runner: () => Promise.reject(new Error('must not run')),
			cliExists: () => Promise.resolve(false)
		});

		importer.sessionEnded(RECORDING);
		await waitUntil(() => events.includes('import-skipped'), 'the skip');
		await importer.close();
	});

	it('logs a failed import and carries on', async () => {
		const events: string[] = [];

		const importer = new SessionImporter({
			delayMs: 0,
			log: (event) => events.push(event),
			runner: () => Promise.reject(new Error('exit 1')),
			cliExists: () => Promise.resolve(true)
		});

		importer.sessionEnded(RECORDING);
		await waitUntil(() => events.includes('import-failed'), 'the failure');
		await importer.close();
	});

	it('drops an import still waiting when the server stops', async () => {
		const runs: Recording[] = [];

		const importer = new SessionImporter({
			delayMs: 60_000,
			log: noLog,
			runner: (recording) => {
				runs.push(recording);

				return Promise.resolve();
			},
			cliExists: () => Promise.resolve(true)
		});

		importer.sessionEnded(RECORDING);
		await importer.close();
		assert.deepEqual(runs, []);
	});
});

describe('a live session that finishes', () => {
	let playback: Playback | undefined;

	after(async () => playback?.stop());

	it('is recorded in archive format and handed to the import', async () => {
		const runs: Recording[] = [];

		const importer = new SessionImporter({
			delayMs: 0,
			log: noLog,
			runner: (recording) => {
				runs.push(recording);

				return Promise.resolve();
			},
			cliExists: () => Promise.resolve(true)
		});

		const rawDir = tempDir();

		playback = await startPlayback(await loadReplayFrames(FIXTURE_DIR), {
			server: { importer, rawDir }
		});

		await untilQuiet(playback.server);
		await waitUntil(() => runs.length > 0, 'the import');

		const [recording] = runs;

		assert.equal(recording?.key, 9858);
		assert.equal(
			recording?.dir,
			path.join(rawDir, '2025/2025-11-22_Las_Vegas_Grand_Prix/2025-11-22_Race')
		);
		assert.ok(recording && existsSync(path.join(recording.dir, 'TimingData.jsonStream')));

		// What the import will read gives the same session as the archive it came from.
		if (recording) {
			assert.deepEqual(await reduceDirectly(recording.dir), await reduceDirectly(FIXTURE_DIR));
		}
	});
});
