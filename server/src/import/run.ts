import { stat } from 'node:fs/promises';
import path from 'node:path';

import { buildCatalog } from '../catalog/catalog.js';
import type { IndexedSeason } from '../catalog/season-index.js';
import { mapLimited } from '../pkg/http.js';
import { fetchMeetingResults } from '../sources/openf1/fetch-result.js';
import { folderBytes, openF1CacheOf, outputKeys, rawDirOf, writeCatalog } from '../sinks/files.js';
import { removeOutlines, telemetryKeys } from '../telemetry/files.js';
import { ArchiveMissing, fetchSeasonIndex, fetchSession } from './fetch.js';
import { ingestSession } from './ingest.js';
import type { IngestResult } from './ingest.js';
import { adoptSession, discoverSessions, findSessionDirs, readSeasonIndexes } from './local.js';
import { chooseBySelection } from './select.js';
import type { Chosen, ImportTarget, RawSession, Selection, Skipped } from './select.js';

const FIRST_SEASON = 2018;

/** OpenF1 results older than this are kept as saved; newer ones are fetched again for late decisions. */
const RESULT_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

const SESSIONS_AT_ONCE = 3;

export interface ImportOptions {
	dataDir: string;
	/** No network at all: read the raw files and saved results already in the data directory. */
	offline: boolean;
	/** Build each session's telemetry from its Position.z and CarData.z. */
	telemetry: boolean;
	now: Date;
	log: (message: string) => void;
}

export interface SessionOutcome {
	key: number;
	label: string;
	result: IngestResult | null;
	/** Why the session failed; null when it was imported. */
	failure: string | null;
	downloadedFiles: number;
}

interface Imported {
	outcomes: SessionOutcome[];
	skipped: Skipped[];
}

/** What fetching one session came to: files saved, or why it could not be fetched. */
interface Fetched {
	downloaded: number;
	failure: string | null;
}

export interface ImportReport {
	outcomes: SessionOutcome[];
	skipped: Skipped[];
	wallMs: number;
	rawBytes: number;
}

/** The season indexes to pick sessions from: fetched when online, otherwise as saved. */
async function loadSeasons(selection: Selection, options: ImportOptions): Promise<IndexedSeason[]> {
	const rawDir = rawDirOf(options.dataDir);

	if (options.offline) {
		return readSeasonIndexes(rawDir);
	}

	const thisYear = options.now.getUTCFullYear();

	const years =
		selection.kind === 'meeting'
			? selection.years
			: Array.from({ length: thisYear - FIRST_SEASON + 1 }, (_, index) => thisYear - index);

	const files = await mapLimited(years, 3, async (year) => {
		try {
			return await fetchSeasonIndex(year, rawDir);
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);

			options.log(`season ${year}: kept the saved index: ${reason}`);

			return null;
		}
	});

	options.log(
		`season indexes: ${files.filter((file) => file !== null).length} of ${years.length} fetched`
	);

	return readSeasonIndexes(rawDir);
}

async function ingestRaw(
	session: RawSession,
	options: ImportOptions,
	downloadedFiles: number
): Promise<SessionOutcome> {
	try {
		const result = await ingestSession({
			rawDir: path.join(rawDirOf(options.dataDir), session.path),
			key: session.key,
			dataDir: options.dataDir,
			telemetry: options.telemetry
		});

		return { key: session.key, label: session.label, result, failure: null, downloadedFiles };
	} catch (error) {
		const failure = error instanceof Error ? error.message : String(error);

		return { key: session.key, label: session.label, result: null, failure, downloadedFiles };
	}
}

function unkeyed(folder: string): SessionOutcome {
	return {
		key: 0,
		label: folder,
		result: null,
		failure: 'no key: not a live recording and not in a saved season index',
		downloadedFiles: 0
	};
}

async function fileExists(file: string): Promise<boolean> {
	return stat(file).then(
		() => true,
		() => false
	);
}

/** Saves OpenF1's results of the meetings whose sessions finished; a failure only logs. */
async function fetchResults(
	targets: readonly ImportTarget[],
	options: ImportOptions
): Promise<void> {
	const meetings = new Map<number, ImportTarget[]>();

	for (const target of targets.filter((candidate) => candidate.type !== 'practice')) {
		meetings.set(target.meetingKey, [...(meetings.get(target.meetingKey) ?? []), target]);
	}

	for (const [meetingKey, sessions] of meetings) {
		const kept = await Promise.all(
			sessions.map(
				async (session) =>
					(await fileExists(openF1CacheOf(options.dataDir, session.key))) &&
					Date.parse(session.endsAt) + RESULT_REFRESH_MS < options.now.getTime()
			)
		);

		if (kept.every(Boolean)) {
			continue;
		}

		try {
			const saved = await fetchMeetingResults(
				options.dataDir,
				meetingKey,
				sessions.map((session) => session.key)
			);

			options.log(`openf1: meeting ${meetingKey}, ${saved.length} results`);
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);

			options.log(`openf1: meeting ${meetingKey} skipped: ${reason}`);
		}
	}
}

async function fetchTargets(chosen: Chosen, options: ImportOptions): Promise<Map<number, Fetched>> {
	const rawDir = rawDirOf(options.dataDir);
	const fetched = new Map<number, Fetched>();
	const total = chosen.targets.length;

	await mapLimited(chosen.targets, SESSIONS_AT_ONCE, async (target) => {
		let line: string;

		try {
			const stats = await fetchSession(target, rawDir, options.now);

			fetched.set(target.key, { downloaded: stats.downloaded, failure: null });
			line =
				stats.downloaded === 0
					? 'up to date'
					: `${stats.downloaded} files, ${(stats.bytes / 1e6).toFixed(1)} MB`;
		} catch (error) {
			const failure = error instanceof Error ? error.message : String(error);

			fetched.set(target.key, { downloaded: 0, failure });
			line = `${error instanceof ArchiveMissing ? 'not in the archive' : 'failed'}: ${failure}`;
		}

		options.log(`[${fetched.size}/${total}] ${target.label} (${target.key}): ${line}`);
	});

	return fetched;
}

/** Rebuilds `out/catalog.json` from the season indexes under the raw directory. */
async function writeCatalogFromRaw(options: ImportOptions): Promise<void> {
	const rawDir = rawDirOf(options.dataDir);
	const seasons = await readSeasonIndexes(rawDir);

	const sessions = seasons.flatMap((season) =>
		season.meetings.flatMap((meeting) => meeting.sessions)
	);

	const present = new Set(await findSessionDirs(rawDir));

	await writeCatalog(
		options.dataDir,
		buildCatalog(
			seasons,
			{
				raw: new Set(
					sessions
						.filter((session) => present.has(session.path?.replace(/\/$/, '') ?? ''))
						.map((session) => session.key)
				),
				events: new Set(await outputKeys(options.dataDir, 'events')),
				snapshots: new Set(await outputKeys(options.dataDir, 'snapshots')),
				telemetry: new Set(await telemetryKeys(options.dataDir))
			},
			options.now
		)
	);
}

/** Sessions from the season indexes: fetch them unless offline, then ingest each. */
async function importFromArchive(
	selection: Extract<Selection, { kind: 'meeting' | 'key' }>,
	options: ImportOptions
): Promise<Imported> {
	const chosen = chooseBySelection(await loadSeasons(selection, options), selection, options.now);

	options.log(`${chosen.targets.length} sessions to import, ${chosen.skipped.length} skipped`);

	const fetched = options.offline
		? new Map<number, Fetched>()
		: await fetchTargets(chosen, options);

	await fetchResults(
		chosen.targets.filter(
			(target) =>
				fetched.get(target.key)?.failure === null &&
				Date.parse(target.endsAt) < options.now.getTime()
		),
		options
	);

	const outcomes: SessionOutcome[] = [];

	for (const target of chosen.targets) {
		const failure = fetched.get(target.key)?.failure ?? null;

		outcomes.push(
			failure === null
				? await ingestRaw(target, options, fetched.get(target.key)?.downloaded ?? 0)
				: { key: target.key, label: target.label, result: null, failure, downloadedFiles: 0 }
		);
		options.log(
			`${failure === null ? 'ingested' : 'not ingested:'} ${target.label} (${target.key})`
		);
	}

	return { outcomes, skipped: chosen.skipped };
}

/** Live recordings under `root`, copied into the raw directory and ingested. */
async function importFromDir(
	selection: Extract<Selection, { kind: 'fromDir' }>,
	options: ImportOptions
): Promise<Imported> {
	const rawDir = rawDirOf(options.dataDir);
	const outcomes: SessionOutcome[] = [];

	for (const session of await discoverSessions(selection.root)) {
		if (selection.key !== undefined && session.key !== selection.key) {
			continue;
		}

		if (session.key === null) {
			outcomes.push(unkeyed(session.path));
			continue;
		}

		const copied = await adoptSession(selection.root, rawDir, session);

		options.log(
			`${session.path} (${session.key}): ${copied ? 'copied' : 'already in the raw directory'}`
		);
		outcomes.push(
			await ingestRaw(
				{ ...session, key: session.key, label: session.path },
				options,
				copied ? 1 : 0
			)
		);
	}

	return { outcomes, skipped: [] };
}

/** Every session folder under the raw directory, for `rebuild`: outputs derived again from raw alone. */
async function importFromLocal(options: ImportOptions): Promise<Imported> {
	const outcomes: SessionOutcome[] = [];

	// A circuit is drawn from the first session built, so only a rebuild from nothing is repeatable.
	if (options.telemetry) {
		await removeOutlines(options.dataDir);
	}

	for (const session of await discoverSessions(rawDirOf(options.dataDir))) {
		if (session.key === null) {
			outcomes.push(unkeyed(session.path));
			continue;
		}

		outcomes.push(
			await ingestRaw({ ...session, key: session.key, label: session.path }, options, 0)
		);
		options.log(`rebuilt ${session.path} (${session.key})`);
	}

	return { outcomes, skipped: [] };
}

async function importSelection(selection: Selection, options: ImportOptions): Promise<Imported> {
	switch (selection.kind) {
		case 'fromDir':
			return importFromDir(selection, options);
		case 'local':
			return importFromLocal(options);
		case 'meeting':
		case 'key':
			return importFromArchive(selection, options);
	}
}

export async function runImport(
	selection: Selection,
	options: ImportOptions
): Promise<ImportReport> {
	const started = Date.now();
	const { outcomes, skipped } = await importSelection(selection, options);

	await writeCatalogFromRaw(options);

	return {
		outcomes,
		skipped,
		wallMs: Date.now() - started,
		rawBytes: await folderBytes(rawDirOf(options.dataDir))
	};
}
