import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import type { EventLog } from './live.js';
import { formatOffset, RawWriter } from './raw-writer.js';

const PRACTICE_3 = {
	Key: 11729,
	Name: 'Practice 3',
	Path: '2026/2026-10-04_Bahrain_Grand_Prix/2026-10-03_Practice_3/'
};

const QUALIFYING = {
	Key: 11730,
	Name: 'Qualifying',
	Path: '2026/2026-10-04_Bahrain_Grand_Prix/2026-10-03_Qualifying/'
};

const T0 = Date.parse('2026-10-03T04:15:00.000Z');

const roots: string[] = [];

after(() => {
	for (const root of roots) {
		rmSync(root, { recursive: true, force: true });
	}
});

function tempRoot(): string {
	const root = mkdtempSync(join(tmpdir(), 'pitwall-raw-'));

	roots.push(root);

	return root;
}

function at(ms: number): string {
	return new Date(ms).toISOString();
}

const quiet: EventLog = () => undefined;

describe('formatOffset', () => {
	it('pads every field like the archive', () => {
		assert.equal(formatOffset(0), '00:00:00.000');
		assert.equal(formatOffset(3_723_456), '01:02:03.456');
		assert.equal(formatOffset(59_999.6), '00:01:00.000');
	});

	it('clamps a frame stamped before the origin to zero', () => {
		assert.equal(formatOffset(-250), '00:00:00.000');
	});
});

describe('RawWriter', () => {
	it('writes the archive line format, offset from the first sight of the session', () => {
		const root = tempRoot();
		const writer = new RawWriter(root, quiet, () => T0);

		writer.writeSnapshot({ SessionInfo: PRACTICE_3, Heartbeat: { Utc: at(T0) } });
		writer.writeFrame({ topic: 'TimingData', payload: { Lines: {} }, timestamp: at(T0 + 1234) });
		writer.writeFrame({ topic: 'CarData.z', payload: 'eJy=', timestamp: at(T0 + 3_600_005) });
		writer.close();

		const dir = join(root, PRACTICE_3.Path);

		assert.equal(
			readFileSync(join(dir, 'TimingData.jsonStream'), 'utf8'),
			'\uFEFF00:00:01.234{"Lines":{}}\r\n'
		);
		assert.equal(
			readFileSync(join(dir, 'CarData.z.jsonStream'), 'utf8'),
			'\uFEFF01:00:00.005"eJy="\r\n'
		);
		assert.equal(
			readFileSync(join(dir, '_subscribe.jsonStream'), 'utf8'),
			`\uFEFF00:00:00.000${JSON.stringify({ SessionInfo: PRACTICE_3, Heartbeat: { Utc: at(T0) } })}\r\n`
		);
		assert.deepEqual(JSON.parse(readFileSync(join(dir, '_recording.json'), 'utf8')), {
			key: 11729,
			path: PRACTICE_3.Path,
			origin: at(T0)
		});
	});

	it('starts the next session at the SessionInfo frame that announces it', () => {
		const root = tempRoot();
		const switchAt = T0 + 3 * 3_600_000;
		const writer = new RawWriter(root, quiet, () => T0);

		writer.writeSnapshot({ SessionInfo: PRACTICE_3 });
		writer.writeFrame({ topic: 'TimingData', payload: { Lines: {} }, timestamp: at(T0 + 10) });
		writer.writeFrame({ topic: 'SessionInfo', payload: QUALIFYING, timestamp: at(switchAt) });
		writer.writeFrame({
			topic: 'TimingData',
			payload: { Lines: { 1: { Position: '1' } } },
			timestamp: at(switchAt + 500)
		});
		writer.close();

		const practice = join(root, PRACTICE_3.Path);
		const qualifying = join(root, QUALIFYING.Path);

		assert.equal(
			readFileSync(join(practice, 'TimingData.jsonStream'), 'utf8'),
			'\uFEFF00:00:00.010{"Lines":{}}\r\n'
		);
		assert.equal(existsSync(join(practice, 'SessionInfo.jsonStream')), false);
		assert.equal(
			readFileSync(join(qualifying, 'SessionInfo.jsonStream'), 'utf8'),
			`\uFEFF00:00:00.000${JSON.stringify(QUALIFYING)}\r\n`
		);
		assert.equal(
			readFileSync(join(qualifying, 'TimingData.jsonStream'), 'utf8'),
			'\uFEFF00:00:00.500{"Lines":{"1":{"Position":"1"}}}\r\n'
		);
	});

	it('appends after a restart and keeps the first origin', () => {
		const root = tempRoot();
		const first = new RawWriter(root, quiet, () => T0);

		first.writeSnapshot({ SessionInfo: PRACTICE_3 });
		first.writeFrame({ topic: 'LapCount', payload: { CurrentLap: 1 }, timestamp: at(T0 + 1000) });
		first.close();

		const second = new RawWriter(root, quiet, () => T0 + 60_000);

		second.writeSnapshot({ SessionInfo: PRACTICE_3 });
		second.writeFrame({
			topic: 'LapCount',
			payload: { CurrentLap: 2 },
			timestamp: at(T0 + 61_000)
		});
		second.close();

		const dir = join(root, PRACTICE_3.Path);

		assert.equal(
			readFileSync(join(dir, 'LapCount.jsonStream'), 'utf8'),
			'\uFEFF00:00:01.000{"CurrentLap":1}\r\n00:01:01.000{"CurrentLap":2}\r\n'
		);
		assert.match(
			readFileSync(join(dir, '_subscribe.jsonStream'), 'utf8'),
			/^\uFEFF00:00:00\.000\{.*\}\r\n00:01:00\.000\{.*\}\r\n$/
		);
	});

	it('still records when the saved origin is unreadable', () => {
		const root = tempRoot();
		const dir = join(root, PRACTICE_3.Path);
		const events: string[] = [];

		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, '_recording.json'), '');

		const writer = new RawWriter(
			root,
			(event) => events.push(event),
			() => T0
		);

		writer.writeSnapshot({ SessionInfo: PRACTICE_3 });
		writer.writeFrame({ topic: 'LapCount', payload: { CurrentLap: 1 }, timestamp: at(T0 + 1000) });
		writer.close();

		assert.deepEqual(events, ['recording-unreadable', 'session']);
		assert.deepEqual(JSON.parse(readFileSync(join(dir, '_recording.json'), 'utf8')), {
			key: 11729,
			path: PRACTICE_3.Path,
			origin: at(T0)
		});
		assert.equal(
			readFileSync(join(dir, 'LapCount.jsonStream'), 'utf8'),
			'\uFEFF00:00:01.000{"CurrentLap":1}\r\n'
		);
	});

	it('uses the time of arrival when a frame has no timestamp', () => {
		const root = tempRoot();
		let now = T0;
		const writer = new RawWriter(root, quiet, () => now);

		writer.writeSnapshot({ SessionInfo: PRACTICE_3 });
		now = T0 + 42;
		writer.writeFrame({ topic: 'TrackStatus', payload: { Status: '1' }, timestamp: null });
		writer.close();

		assert.equal(
			readFileSync(join(root, PRACTICE_3.Path, 'TrackStatus.jsonStream'), 'utf8'),
			'\uFEFF00:00:00.042{"Status":"1"}\r\n'
		);
	});

	it('keeps a session with an unsafe path inside the root', () => {
		const root = tempRoot();
		const writer = new RawWriter(root, quiet, () => T0);

		writer.writeSnapshot({ SessionInfo: { Key: 11729, Path: '../../outside/' } });
		writer.writeFrame({ topic: '../escape', payload: {}, timestamp: at(T0) });
		writer.close();

		assert.equal(existsSync(join(root, 'unindexed/11729/_subscribe.jsonStream')), true);
		assert.equal(existsSync(join(root, '../outside')), false);
		assert.equal(existsSync(join(root, 'unindexed/escape.jsonStream')), false);
	});

	it('logs frames that arrive before any session instead of throwing', () => {
		const root = tempRoot();
		const events: string[] = [];

		const writer = new RawWriter(
			root,
			(event) => events.push(event),
			() => T0
		);

		writer.writeFrame({ topic: 'TimingData', payload: {}, timestamp: at(T0) });
		writer.close();

		assert.deepEqual(events, ['write-failed']);
	});
});
