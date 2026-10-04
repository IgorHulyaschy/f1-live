import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { deflateRawSync } from 'node:zlib';

import { parseJsonStream } from './archive.js';
import type { JsonObject } from './live.js';
import {
	CAR_DATA_TOPIC,
	POSITION_TOPIC,
	decodeCarDataPayload,
	decodePositionPayload,
	decodeTelemetryFrames
} from './telemetry.js';

/** Ten seconds of the 2025 Las Vegas race, 04:21:20 to 04:21:30 UTC, as the archive has them. */
function fixtureFrames(topic: string, folder = '2025-las-vegas-telemetry') {
	const text = readFileSync(
		path.join(import.meta.dirname, 'fixtures', folder, `${topic}.jsonStream`),
		'utf8'
	);

	return parseJsonStream(topic, text).map((line) => ({
		topic,
		data: line.data,
		timestamp: line.offsetMs
	}));
}

function compress(json: JsonObject): string {
	return deflateRawSync(JSON.stringify(json)).toString('base64');
}

describe('decodeTelemetryFrames on ten seconds of the Las Vegas race', () => {
	const streams = decodeTelemetryFrames([
		...fixtureFrames(POSITION_TOPIC),
		...fixtureFrames(CAR_DATA_TOPIC)
	]);

	it('reads every sample of every car, in time order', () => {
		assert.equal(streams.skipped, 0);
		assert.equal(streams.positions.length, 36);
		assert.equal(streams.carData.length, 36);
		assert.ok(streams.positions.every((sample) => sample.cars.size === 20));

		const times = streams.positions.map((sample) => sample.at);

		assert.deepEqual(
			times,
			times.toSorted((a, b) => a - b)
		);
		assert.equal(new Date(times[0] ?? 0).toISOString(), '2025-11-23T04:21:20.248Z');
		assert.ok((times.at(-1) ?? 0) - (times[0] ?? 0) < 10_000);
	});

	it('turns tenths of a metre into metres', () => {
		assert.deepEqual(streams.positions[0]?.cars.get('1'), {
			x: 332.9,
			y: 198.3,
			z: 606,
			status: 'OnTrack'
		});
	});

	it('reads the car data channels', () => {
		assert.deepEqual(streams.carData[0]?.cars.get('1'), {
			rpm: 9349,
			speedKph: 121,
			gear: 3,
			throttle: 57,
			brake: false,
			drsOpen: false
		});

		const readings = streams.carData.flatMap((sample) => [...sample.cars.values()]);

		assert.equal(Math.max(...readings.map((reading) => reading.speedKph)), 357);
		assert.ok(readings.every((reading) => reading.throttle >= 0 && reading.throttle <= 100));
		assert.ok(readings.every((reading) => reading.gear >= 0 && reading.gear <= 8));
	});
});

/** Three lines of each stream from races of seasons the format changed in, as the archive has them. */
const OLDER_SEASONS = [
	{ folder: '2018-austria-telemetry', day: '2018-07-01', positions: 10, carData: 13 },
	{ folder: '2021-abu-dhabi-telemetry', day: '2021-12-12', positions: 14, carData: 13 },
	{ folder: '2024-bahrain-telemetry', day: '2024-03-02', positions: 11, carData: 11 }
];

describe('decodeTelemetryFrames on older seasons', () => {
	for (const season of OLDER_SEASONS) {
		it(`reads every sample of ${season.folder}`, () => {
			const streams = decodeTelemetryFrames([
				...fixtureFrames(POSITION_TOPIC, season.folder),
				...fixtureFrames(CAR_DATA_TOPIC, season.folder)
			]);

			assert.equal(streams.skipped, 0);
			assert.equal(streams.positions.length, season.positions);
			assert.equal(streams.carData.length, season.carData);

			const cars = streams.positions.flatMap((sample) => [...sample.cars.values()]);
			const readings = streams.carData.flatMap((sample) => [...sample.cars.values()]);

			assert.ok(streams.positions.every((sample) => sample.cars.size === 20));
			assert.ok(cars.every((car) => car.status === 'OnTrack' || car.status === 'OffTrack'));
			assert.ok(cars.every((car) => Math.abs(car.x) < 2000 && Math.abs(car.y) < 2000));
			assert.ok(readings.every((reading) => reading.speedKph >= 0 && reading.speedKph < 370));
			assert.ok(readings.every((reading) => reading.drsOpen !== null));
			assert.ok(
				[...streams.positions, ...streams.carData].every((sample) =>
					new Date(sample.at).toISOString().startsWith(season.day)
				)
			);
		});
	}

	it('reads the numbered statuses of 2018 as on and off track', () => {
		const [sample] = decodeTelemetryFrames(
			fixtureFrames(POSITION_TOPIC, '2018-austria-telemetry')
		).positions;

		assert.deepEqual(sample?.cars.get('2'), { x: -312.7, y: -222.3, z: 737.2, status: 'OnTrack' });
		assert.deepEqual(sample?.cars.get('14'), { x: 0, y: 0, z: 0, status: 'OffTrack' });
	});
});

describe('decodePositionPayload', () => {
	it('keeps the timestamp and each car status', () => {
		const samples = decodePositionPayload(
			compress({
				Position: [
					{
						Timestamp: '2025-11-23T03:08:27.4144276Z',
						Entries: { '44': { Status: 'OffTrack', X: -7680, Y: 5875, Z: 6141 } }
					}
				]
			})
		);

		assert.equal(samples[0]?.at, Date.parse('2025-11-23T03:08:27.414Z'));
		assert.equal(samples[0]?.cars.get('44')?.status, 'OffTrack');
		assert.equal(samples[0]?.cars.get('44')?.x, -768);
	});

	it('rejects a payload that is not in the feed format', () => {
		assert.throws(() => decodePositionPayload(compress({ Position: [{ Entries: {} }] })));
		assert.throws(() =>
			decodePositionPayload(
				compress({
					Position: [
						{
							Timestamp: '2018-07-01T13:12:55.1143164Z',
							Entries: { '14': { Status: 7, X: 0, Y: 0, Z: 0 } }
						}
					]
				})
			)
		);
		assert.throws(() => decodePositionPayload('not deflate'));
	});
});

describe('decodeCarDataPayload', () => {
	const at = '2025-11-23T04:21:20.312Z';

	it('reads a missing pedal as 0, brake only at 100 and DRS open from 10', () => {
		const [sample] = decodeCarDataPayload(
			compress({
				Entries: [
					{
						Utc: at,
						Cars: {
							'1': { Channels: { '0': 0, '2': 0, '3': 0, '4': 104, '5': 104, '45': 1 } },
							'4': { Channels: { '0': 11000, '2': 300, '3': 8, '4': 100, '5': 0, '45': 12 } },
							'5': { Channels: { '0': 9000, '2': 90, '3': 3, '4': 0, '5': 100, '45': 8 } }
						}
					}
				]
			})
		);

		assert.deepEqual(sample?.cars.get('1'), {
			rpm: 0,
			speedKph: 0,
			gear: 0,
			throttle: 0,
			brake: false,
			drsOpen: false
		});
		assert.equal(sample?.cars.get('4')?.drsOpen, true);
		assert.equal(sample?.cars.get('4')?.throttle, 100);
		assert.equal(sample?.cars.get('5')?.brake, true);
		assert.equal(sample?.cars.get('5')?.drsOpen, false);
	});

	it('reports no DRS where the feed has no channel for it', () => {
		const [sample] = decodeCarDataPayload(
			compress({
				Entries: [{ Utc: at, Cars: { '1': { Channels: { '0': 5000, '2': 100, '3': 2 } } } }]
			})
		);

		assert.equal(sample?.cars.get('1')?.drsOpen, null);
	});
});

describe('decodeTelemetryFrames', () => {
	it('counts a frame it cannot read and goes on', () => {
		const good = compress({
			Entries: [{ Utc: '2025-11-23T04:21:20.312Z', Cars: { '1': { Channels: { '2': 100 } } } }]
		});

		const streams = decodeTelemetryFrames([
			{ topic: CAR_DATA_TOPIC, data: 'garbage', timestamp: 1 },
			{ topic: CAR_DATA_TOPIC, data: 42, timestamp: 2 },
			{ topic: CAR_DATA_TOPIC, data: good, timestamp: 3 },
			{ topic: 'TimingData', data: good, timestamp: 4 }
		]);

		assert.equal(streams.skipped, 2);
		assert.equal(streams.carData.length, 1);
		assert.equal(streams.positions.length, 0);
	});
});
