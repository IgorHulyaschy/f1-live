import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { deflateRawSync } from 'node:zlib';

import { z } from 'zod';

import {
	archiveTopics,
	inflatePayload,
	mergeStreams,
	parseJsonStream,
	readArchive,
	streamStartedAt
} from './archive.js';
import { F1_TOPICS, F1Decoder } from './decode.js';
import { RawWriter } from './raw-writer.js';

const FIXTURES = path.join(import.meta.dirname, 'fixtures/2025-las-vegas-race');

const roots: string[] = [];

after(() => {
	for (const root of roots) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe('parseJsonStream', () => {
	it('reads offsets and JSON after the BOM, with either line ending', () => {
		const lines = parseJsonStream(
			'LapCount',
			'﻿00:00:01.453{"CurrentLap":1,"TotalLaps":50}\r\n00:59:23.935{"CurrentLap":2}\n\n'
		);

		assert.deepEqual(lines, [
			{ offsetMs: 1_453, data: { CurrentLap: 1, TotalLaps: 50 } },
			{ offsetMs: 3_563_935, data: { CurrentLap: 2 } }
		]);
	});

	it('names the file and line it cannot read', () => {
		assert.throws(
			() => parseJsonStream('TrackStatus', '00:00:00.000{"Status":"1"}\n12:5{"Status":"2"}'),
			/TrackStatus\.jsonStream line 2/
		);
	});
});

describe('streamStartedAt', () => {
	it('prefers the extrapolated clock to the heartbeat, which runs late', () => {
		const streams = new Map([
			[
				'Heartbeat',
				parseJsonStream('Heartbeat', '00:00:13.365{"Utc":"2025-11-23T03:06:42.2510631Z"}')
			],
			[
				'ExtrapolatedClock',
				parseJsonStream('ExtrapolatedClock', '00:00:01.156{"Utc":"2025-11-23T03:06:28.006Z"}')
			]
		]);

		assert.equal(new Date(streamStartedAt(streams)).toISOString(), '2025-11-23T03:06:26.850Z');
		assert.equal(
			new Date(
				streamStartedAt(new Map([['Heartbeat', streams.get('Heartbeat') ?? []]]))
			).toISOString(),
			'2025-11-23T03:06:28.886Z'
		);
	});

	it('refuses a stream it cannot place in time', () => {
		assert.throws(() => streamStartedAt(new Map()), /ExtrapolatedClock or Heartbeat/);
	});
});

describe('mergeStreams', () => {
	it('orders frames by time and keeps the topic order at the same instant', () => {
		const frames = mergeStreams(
			new Map([
				['PitLaneTimeCollection', [{ offsetMs: 20, data: 'lane' }]],
				[
					'PitStopSeries',
					[
						{ offsetMs: 10, data: 'early' },
						{ offsetMs: 20, data: 'series' }
					]
				]
			]),
			1_000
		);

		assert.deepEqual(
			frames.map((frame) => [frame.timestamp, frame.topic, frame.data]),
			[
				[1_010, 'PitStopSeries', 'early'],
				[1_020, 'PitLaneTimeCollection', 'lane'],
				[1_020, 'PitStopSeries', 'series']
			]
		);
	});
});

describe('readArchive', () => {
	it('merges a session directory into one time-ordered stream of decoder topics', async () => {
		const frames = await readArchive(FIXTURES);

		assert.equal(frames[0]?.topic, 'SessionInfo');
		assert.equal(new Date(frames[0]?.timestamp ?? 0).toISOString(), '2025-11-23T03:06:26.850Z');
		assert.ok(
			frames.every(
				(frame, index) => index === 0 || frame.timestamp >= (frames[index - 1]?.timestamp ?? 0)
			)
		);
		assert.deepEqual(
			[...new Set(frames.map((frame) => frame.topic))].toSorted(),
			[...F1_TOPICS].toSorted()
		);
	});

	it('reads any topic, compressed ones included', async () => {
		assert.ok((await archiveTopics(FIXTURES)).includes('CarData.z'));

		const [first] = await readArchive(FIXTURES, ['CarData.z']);
		const payload = z.string().parse(first?.data);
		const entries = z.object({ Entries: z.array(z.object({ Utc: z.string() })) });

		assert.equal(
			entries.parse(JSON.parse(inflatePayload(payload))).Entries[0]?.Utc,
			'2025-11-23T03:06:27.2581019Z'
		);
	});
});

describe('readArchive on a live recording', () => {
	it('starts each topic from the subscribe result and times it from the recording origin', async () => {
		const root = mkdtempSync(path.join(tmpdir(), 'pitwall-archive-'));
		const sessionPath = '2026/2026-10-04_Bahrain_Grand_Prix/2026-10-03_Practice_3/';
		const origin = Date.parse('2026-10-03T04:15:00.000Z');

		const writer = new RawWriter(
			root,
			() => undefined,
			() => origin
		);

		roots.push(root);
		writer.writeSnapshot({
			SessionInfo: { Key: 11729, Name: 'Practice 3', Path: sessionPath },
			DriverList: {
				'1': {
					Tla: 'VER',
					FirstName: 'Max',
					LastName: 'Verstappen',
					TeamName: 'Red Bull Racing',
					TeamColour: '4781D7'
				}
			},
			TimingData: { Lines: { '1': { Position: '1', NumberOfLaps: 3 } } }
		});
		writer.writeFrame({
			topic: 'TimingData',
			payload: { Lines: { '1': { NumberOfLaps: 4, LastLapTime: { Value: '1:33.365' } } } },
			timestamp: new Date(origin + 90_000).toISOString()
		});
		writer.close();

		const frames = await readArchive(path.join(root, sessionPath));

		assert.deepEqual(
			frames.map((frame) => [frame.topic, frame.timestamp - origin]),
			[
				['SessionInfo', 0],
				['DriverList', 0],
				['TimingData', 0],
				['TimingData', 90_000]
			]
		);

		const decoder = new F1Decoder();

		assert.deepEqual(
			frames
				.flatMap((frame) => decoder.decode(frame))
				.flatMap((event) => (event.kind === 'lap_completed' ? [event.lap] : [])),
			[3, 4]
		);
	});
});

describe('inflatePayload', () => {
	it('undoes base64 and raw deflate', () => {
		const payload = deflateRawSync('{"Position":[]}').toString('base64');

		assert.equal(inflatePayload(payload), '{"Position":[]}');
	});
});
