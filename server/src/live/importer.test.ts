import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import { parseImportArguments } from '../import/args.js';
import { runImport } from '../import/run.js';
import { RAW_DATA_DIR } from '../sources/f1/archive.js';
import { sessionTelemetryDir } from '../telemetry/files.js';
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

const LAS_VEGAS_DIR = path.join(
	RAW_DATA_DIR,
	'2025/2025-11-22_Las_Vegas_Grand_Prix/2025-11-22_Race'
);

const RECORDING: Recording = { key: 9858, dir: '/data/raw/2025/x/y', root: '/data/raw' };

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
	const running: Playback[] = [];

	after(async () => {
		await Promise.all(running.map((playback) => playback.stop()));
	});

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

		const playback = await startPlayback(await loadReplayFrames(FIXTURE_DIR), {
			server: { importer, rawDir }
		});

		running.push(playback);

		await untilQuiet(playback.server);
		await waitUntil(() => runs.length > 0, 'the import');

		const [recording] = runs;

		assert.equal(recording?.key, 9858);
		assert.equal(recording?.root, rawDir, 'the import reads the raw root, not the session folder');
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

	it(
		'gets its telemetry from the same import, run on what the live path recorded',
		{
			timeout: 120_000,
			skip:
				!existsSync(path.join(LAS_VEGAS_DIR, 'Position.z.jsonStream')) &&
				`no raw data in ${LAS_VEGAS_DIR}; run npm run fetch:f1 -w server -- 9858`
		},
		async () => {
			const dataDir = tempDir();
			let imported: Promise<void> | undefined;

			// What `runImportCli` runs, in this process.
			const importer = new SessionImporter({
				delayMs: 0,
				log: noLog,
				runner: ({ key, root }) => {
					const args = parseImportArguments(
						['--from-dir', root, '--key', String(key), '--data-dir', dataDir, '--offline'],
						{}
					);

					imported = runImport(args.selection, { ...args, log: noLog }).then(() => undefined);

					return imported;
				},
				cliExists: () => Promise.resolve(true)
			});

			running.push(
				await startPlayback(await loadReplayFrames(LAS_VEGAS_DIR), {
					server: { importer, rawDir: path.join(dataDir, 'raw') }
				})
			);

			await waitUntil(() => imported !== undefined, 'the import to start');
			await imported;

			assert.ok(existsSync(path.join(sessionTelemetryDir(dataDir, 9858), 'index.json')));
		}
	);
});
