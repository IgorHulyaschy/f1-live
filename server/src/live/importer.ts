import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { z } from 'zod';

import type { EventLog } from '../sources/f1/live.js';
import { describeError } from '../sources/f1/live.js';

const run = promisify(execFile);

const SERVER_DIR = path.resolve(import.meta.dirname, '../..');

const REPOSITORY_DIR = path.resolve(SERVER_DIR, '..');

const packageSchema = z.object({ scripts: z.record(z.string(), z.string()).optional() });

/** A recording on disk: the session's key, the directory holding its `<Topic>.jsonStream` files, and the raw root that directory is under. */
export interface Recording {
	key: number;
	dir: string;
	root: string;
}

export type ImportRunner = (recording: Recording) => Promise<void>;

/** Runs the importer CLI (`npm run import -w server`) on a finished recording. */
export const runImportCli: ImportRunner = async ({ key, root }) => {
	await run(
		'npm',
		['run', 'import', '-w', 'server', '--', '--from-dir', root, '--key', String(key)],
		{
			cwd: REPOSITORY_DIR,
			maxBuffer: 16 * 1024 * 1024
		}
	);
};

/** Whether the importer CLI exists yet; it comes from a separate piece of work. */
export async function importCliExists(): Promise<boolean> {
	try {
		const text = await readFile(path.join(SERVER_DIR, 'package.json'), 'utf8');

		return packageSchema.parse(JSON.parse(text)).scripts?.import !== undefined;
	} catch {
		return false;
	}
}

export interface ImporterOptions {
	/** Waits this long after the last end-of-session status, so late race control messages land. */
	delayMs: number;
	log: EventLog;
	runner?: ImportRunner;
	cliExists?: () => Promise<boolean>;
}

/**
 * Turns a finished live recording into a historical session by running the import on it. Every
 * end-of-session status restarts the wait and the import is idempotent, so the last run wins.
 */
export class SessionImporter {
	private readonly options: ImporterOptions;
	private readonly timers = new Map<number, NodeJS.Timeout>();
	private queue: Promise<void> = Promise.resolve();

	constructor(options: ImporterOptions) {
		this.options = options;
	}

	sessionEnded(recording: Recording) {
		clearTimeout(this.timers.get(recording.key));

		const timer = setTimeout(() => {
			this.timers.delete(recording.key);
			this.queue = this.queue.then(() => this.import(recording));
		}, this.options.delayMs);

		timer.unref();
		this.timers.set(recording.key, timer);
		this.options.log('import-scheduled', { key: recording.key, delayMs: this.options.delayMs });
	}

	/** Waits for imports that already started; ones still waiting out their delay are dropped. */
	async close() {
		for (const timer of this.timers.values()) {
			clearTimeout(timer);
		}

		this.timers.clear();
		await this.queue;
	}

	private async import(recording: Recording) {
		const { log, runner = runImportCli, cliExists = importCliExists } = this.options;

		if (!(await cliExists())) {
			log('import-skipped', {
				key: recording.key,
				reason: 'no import script in server/package.json'
			});

			return;
		}

		try {
			await runner(recording);
			log('import-done', { key: recording.key });
		} catch (cause) {
			log('import-failed', { key: recording.key, error: describeError(cause) });
		}
	}
}
