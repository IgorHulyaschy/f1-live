import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import { adoptSession, discoverSessions, readSeasonIndexes } from './local.js';

const roots: string[] = [];

after(() => {
	for (const root of roots) {
		rmSync(root, { recursive: true, force: true });
	}
});

function session(root: string, relative: string, files: Record<string, string>): void {
	mkdirSync(path.join(root, relative), { recursive: true });

	for (const [name, content] of Object.entries(files)) {
		writeFileSync(path.join(root, relative, name), content);
	}
}

function newRoot(): string {
	const root = mkdtempSync(path.join(tmpdir(), 'local-'));

	roots.push(root);

	return root;
}

const SEASON = JSON.stringify({
	Year: 2025,
	Meetings: [
		{
			Key: 1,
			Name: 'Test Grand Prix',
			OfficialName: 'TEST',
			Location: 'Testville',
			Country: { Code: 'TST', Name: 'Testland' },
			Circuit: { ShortName: 'Test' },
			Sessions: [
				{
					Key: 77,
					Type: 'Race',
					Name: 'Race',
					StartDate: '2025-01-01T12:00:00',
					EndDate: '2025-01-01T14:00:00',
					GmtOffset: '00:00:00',
					Path: '2025/2025-01-01_Test_Grand_Prix/2025-01-01_Race/'
				}
			]
		}
	]
});

describe('discoverSessions', () => {
	it('finds session folders and keys them from a season index or a recording marker', async () => {
		const root = newRoot();

		session(root, '2025', { 'Index.json': SEASON });
		session(root, '2025/2025-01-01_Test_Grand_Prix/2025-01-01_Race', {
			'SessionInfo.jsonStream': ''
		});
		session(root, '2026/2026-02-02_Live_Grand_Prix/2026-02-01_Practice_1', {
			'_subscribe.jsonStream': '',
			'_recording.json': JSON.stringify({ key: 500, path: 'x', origin: '2026-02-01T00:00:00Z' })
		});
		session(root, '2026/2026-02-02_Live_Grand_Prix/2026-02-02_Race', {
			'SessionInfo.jsonStream': ''
		});

		assert.deepEqual(await discoverSessions(root), [
			{ path: '2025/2025-01-01_Test_Grand_Prix/2025-01-01_Race', key: 77 },
			{ path: '2026/2026-02-02_Live_Grand_Prix/2026-02-01_Practice_1', key: 500 },
			{ path: '2026/2026-02-02_Live_Grand_Prix/2026-02-02_Race', key: null }
		]);
	});
});

describe('adoptSession', () => {
	it('copies a recording into the raw directory once, and leaves data that is already there', async () => {
		const from = newRoot();
		const rawDir = newRoot();
		const live = { path: '2026/g/p1', key: 500 };

		session(from, live.path, { 'SessionInfo.jsonStream': 'recorded' });

		assert.equal(await adoptSession(from, rawDir, live), true);
		assert.equal(existsSync(path.join(rawDir, live.path, 'SessionInfo.jsonStream')), true);

		writeFileSync(path.join(rawDir, live.path, 'SessionInfo.jsonStream'), 'archive copy');

		assert.equal(await adoptSession(from, rawDir, live), false);
	});
});

describe('readSeasonIndexes', () => {
	it('reads a season the archive publishes no index for from its supplement alone, when asked for', async () => {
		const root = mkdtempSync(path.join(tmpdir(), 'seasons-'));

		after(() => rmSync(root, { recursive: true, force: true }));

		assert.deepEqual(await readSeasonIndexes(root), []);

		const [season, ...others] = await readSeasonIndexes(root, undefined, [2022]);

		assert.equal(others.length, 0);
		assert.equal(season?.year, 2022);
		assert.deepEqual(
			season?.meetings.flatMap((meeting) => meeting.sessions.map((indexed) => indexed.key)),
			[6979, 6973, 6978]
		);
	});
});
