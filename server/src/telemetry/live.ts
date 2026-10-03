import { z } from 'zod';

import type { LiveCarData, LivePositions } from '@f1-live/shared';

import { PROTOCOL_VERSION } from '../live/protocol.js';
import type { CarDataMessage, Channel, PositionsMessage } from '../live/protocol.js';
import type { JsonValue } from '../sources/f1/live.js';
import {
	CAR_DATA_TOPIC,
	POSITION_TOPIC,
	decodeCarDataPayload,
	decodePositionPayload
} from '../sources/f1/telemetry.js';

/** What the telemetry needs from the viewers: who wants a channel, and a way to send to them. */
export interface ChannelSink {
	wants: (channel: Channel) => boolean;
	markLive: (channel: Channel) => void;
	publish: (channel: Channel, text: string) => void;
}

export interface LiveTelemetryOptions {
	/** At most one message per channel in this many ms, whatever the feed sends. */
	intervalMs: number;
	/** Called with the reason when a frame cannot be read. */
	onError?: (reason: string) => void;
}

const payloadSchema = z.string();

/** A car silent for this long is no longer on the circuit. */
const STALE_MS = 10_000;

/**
 * The live feed's `Position.z` and `CarData.z`, throttled, quantised and passed on to the viewers
 * that opted in. Nothing is decoded while nobody wants a channel, so a viewer without a track map
 * costs nothing. The feed sends these topics only with an F1 TV token.
 */
export class LiveTelemetry {
	private readonly sink: ChannelSink;
	private readonly options: LiveTelemetryOptions;
	private readonly positions: LivePositions = { at: 0, cars: {} };
	private readonly carData: LiveCarData = { at: 0, cars: {} };
	private readonly dirty = new Set<Channel>();
	/** When each car was last heard, per channel, to drop one that stopped (a car from an earlier session). */
	private readonly heard = new Map<string, number>();
	private readonly timer: NodeJS.Timeout;

	constructor(sink: ChannelSink, options: LiveTelemetryOptions) {
		this.sink = sink;
		this.options = options;
		this.timer = setInterval(() => this.flush(), options.intervalMs);
		this.timer.unref();
	}

	/** One frame of the feed; others than the two compressed topics are ignored. */
	ingest(topic: string, payload: JsonValue) {
		const channel =
			topic === POSITION_TOPIC ? 'positions' : topic === CAR_DATA_TOPIC ? 'car_data' : null;

		if (channel === null) {
			return;
		}

		const wanted = this.sink.wants(channel);

		if (!wanted) {
			if (payloadSchema.safeParse(payload).success) {
				this.sink.markLive(channel);
			}

			return;
		}

		try {
			const text = payloadSchema.parse(payload);

			this.sink.markLive(channel);

			if (channel === 'positions') {
				this.takePositions(text);
			} else {
				this.takeCarData(text);
			}

			this.dirty.add(channel);
		} catch (cause) {
			this.options.onError?.(`${topic}: ${cause instanceof Error ? cause.message : 'unreadable'}`);
		}
	}

	close() {
		clearInterval(this.timer);
	}

	private takePositions(payload: string) {
		for (const sample of decodePositionPayload(payload)) {
			this.positions.at = Math.max(this.positions.at, sample.at);

			for (const [driver, car] of sample.cars) {
				if (car.x !== 0 || car.y !== 0) {
					this.heard.set(`positions/${driver}`, sample.at);
					this.positions.cars[driver] = [
						Math.round(car.x),
						Math.round(car.y),
						car.status === 'OffTrack' ? 0 : 1
					];
				}
			}
		}
	}

	private takeCarData(payload: string) {
		for (const sample of decodeCarDataPayload(payload)) {
			this.carData.at = Math.max(this.carData.at, sample.at);

			for (const [driver, reading] of sample.cars) {
				this.heard.set(`car_data/${driver}`, sample.at);
				this.carData.cars[driver] = [
					Math.round(reading.speedKph),
					reading.gear,
					Math.round(reading.throttle),
					reading.brake ? 1 : 0,
					Math.round(reading.rpm),
					reading.drsOpen ? 1 : 0
				];
			}
		}
	}

	/** Cars not heard from for this long are left out, so one that is gone is not shown frozen. */
	private prune(channel: Channel, cars: { [driverNumber: string]: readonly number[] }, at: number) {
		for (const driver of Object.keys(cars)) {
			if (at - (this.heard.get(`${channel}/${driver}`) ?? at) > STALE_MS) {
				delete cars[driver];
			}
		}
	}

	private flush() {
		this.prune('positions', this.positions.cars, this.positions.at);
		this.prune('car_data', this.carData.cars, this.carData.at);

		for (const channel of this.dirty) {
			if (channel === 'positions') {
				const message: PositionsMessage = {
					v: PROTOCOL_VERSION,
					type: 'positions',
					at: this.positions.at,
					cars: this.positions.cars
				};

				this.sink.publish(channel, JSON.stringify(message));
			} else {
				const message: CarDataMessage = {
					v: PROTOCOL_VERSION,
					type: 'car_data',
					at: this.carData.at,
					cars: this.carData.cars
				};

				this.sink.publish(channel, JSON.stringify(message));
			}
		}

		this.dirty.clear();
	}
}
