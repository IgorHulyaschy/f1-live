import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { describe, it } from 'node:test';
import { deflateRawSync } from 'node:zlib';

import type { JsonObject } from '../sources/f1/live.js';
import type { Channel } from '../live/protocol.js';
import { LiveTelemetry } from './live.js';
import type { ChannelSink } from './live.js';

const INTERVAL_MS = 30;

function compress(json: JsonObject): string {
	return deflateRawSync(JSON.stringify(json)).toString('base64');
}

function position(at: string, x: number, y: number, status = 'OnTrack'): string {
	return compress({
		Position: [{ Timestamp: at, Entries: { '1': { Status: status, X: x, Y: y, Z: 0 } } }]
	});
}

function setup(wanted: readonly Channel[]) {
	const published: { channel: Channel; message: JsonObject }[] = [];
	const live = new Set<Channel>();
	const errors: string[] = [];

	const sink: ChannelSink = {
		wants: (channel) => wanted.includes(channel),
		markLive: (channel) => live.add(channel),
		publish: (channel, text) => published.push({ channel, message: JSON.parse(text) })
	};

	const telemetry = new LiveTelemetry(sink, {
		intervalMs: INTERVAL_MS,
		onError: (reason) => errors.push(reason)
	});

	return { telemetry, published, live, errors };
}

describe('LiveTelemetry', () => {
	it('sends one rounded positions message per interval, however many frames came', async () => {
		const { telemetry, published } = setup(['positions']);

		telemetry.ingest('Position.z', position('2025-11-23T04:21:20.000Z', 12_344, -5_001));
		telemetry.ingest(
			'Position.z',
			position('2025-11-23T04:21:20.250Z', 12_346, -5_002, 'OffTrack')
		);
		await sleep(INTERVAL_MS * 3);
		telemetry.close();

		assert.equal(published.length, 1);
		assert.deepEqual(published[0], {
			channel: 'positions',
			message: {
				v: 1,
				type: 'positions',
				at: Date.parse('2025-11-23T04:21:20.250Z'),
				cars: { '1': [1235, -500, 0] }
			}
		});
	});

	it('sends car data as numbers, with DRS 0 where the feed has none', async () => {
		const { telemetry, published } = setup(['car_data']);

		telemetry.ingest(
			'CarData.z',
			compress({
				Entries: [
					{
						Utc: '2025-11-23T04:21:20.312Z',
						Cars: { '1': { Channels: { '0': 9349.4, '2': 120.6, '3': 3, '4': 57, '5': 100 } } }
					}
				]
			})
		);
		await sleep(INTERVAL_MS * 3);
		telemetry.close();

		assert.deepEqual(published[0]?.message.cars, { '1': [121, 3, 57, 1, 9349, 0] });
	});

	it('decodes nothing for a channel nobody wants, but notes that the feed has it', async () => {
		const { telemetry, published, live, errors } = setup([]);

		telemetry.ingest('Position.z', 'not even a payload');
		await sleep(INTERVAL_MS * 3);
		telemetry.close();

		assert.deepEqual([...live], ['positions']);
		assert.equal(published.length, 0);
		assert.equal(errors.length, 0);
	});

	it('ignores other topics and reports a frame it cannot read', async () => {
		const { telemetry, published, live, errors } = setup(['positions']);

		telemetry.ingest('TimingData', 'x');
		telemetry.ingest('Position.z', 'garbage');
		telemetry.ingest('Position.z', 42);
		await sleep(INTERVAL_MS * 2);
		telemetry.close();

		assert.equal(live.size, 1);
		assert.equal(published.length, 0);
		assert.equal(errors.length, 2);
		assert.match(errors[0] ?? '', /^Position\.z:/);
	});
});
