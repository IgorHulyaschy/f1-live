import { z } from 'zod';

import { inflatePayload } from './archive.js';
import type { TopicFrame } from './decode.js';

/** The compressed topics: base64 of raw deflate around JSON. The live feed withholds them without a token. */
export const POSITION_TOPIC = 'Position.z';

export const CAR_DATA_TOPIC = 'CarData.z';

export const TELEMETRY_TOPICS = [POSITION_TOPIC, CAR_DATA_TOPIC] as const;

/** Position X, Y and Z come as tenths of a metre; Las Vegas then spans 1.1 by 1.9 km, as it should. */
const UNITS_PER_METRE = 10;

/** The feed's channel numbers in `CarData.z`. */
const CHANNEL = { rpm: '0', speed: '2', gear: '3', throttle: '4', brake: '5', drs: '45' } as const;

/** Throttle and brake read 104 when the car has no reading, as in the garage with the engine off. */
const PEDAL_MAX = 100;

/** DRS: 0 and 1 closed, 8 detected, 10, 12 and 14 open. */
const DRS_OPEN_FROM = 10;

const positionPayloadSchema = z.object({
	Position: z.array(
		z.object({
			Timestamp: z.iso.datetime(),
			Entries: z.record(
				z.string(),
				z.object({ Status: z.string(), X: z.number(), Y: z.number(), Z: z.number() })
			)
		})
	)
});

const carDataPayloadSchema = z.object({
	Entries: z.array(
		z.object({
			Utc: z.iso.datetime(),
			Cars: z.record(z.string(), z.object({ Channels: z.record(z.string(), z.number()) }))
		})
	)
});

export interface CarPosition {
	/** Metres, in the feed's frame. A car with no fix yet reads (0, 0). */
	x: number;
	y: number;
	z: number;
	/** As the feed says: "OnTrack" or "OffTrack". */
	status: string;
}

/** Every car's position at one moment. */
export interface PositionSample {
	/** Milliseconds since the Unix epoch. */
	at: number;
	cars: ReadonlyMap<string, CarPosition>;
}

export interface CarReading {
	rpm: number;
	speedKph: number;
	/** 0 is neutral. */
	gear: number;
	/** 0 to 100. */
	throttle: number;
	brake: boolean;
	/** True while the flap is open; null when the feed has no DRS channel, as from 2026. */
	drsOpen: boolean | null;
}

export interface CarDataSample {
	at: number;
	cars: ReadonlyMap<string, CarReading>;
}

function parsePayload<T extends z.ZodType>(schema: T, payload: string): z.output<T> {
	return schema.parse(JSON.parse(inflatePayload(payload)));
}

/** The samples in a `Position.z` payload; throws when it is not in the feed's format. */
export function decodePositionPayload(payload: string): PositionSample[] {
	return parsePayload(positionPayloadSchema, payload).Position.map((entry) => ({
		at: Date.parse(entry.Timestamp),
		cars: new Map(
			Object.entries(entry.Entries).map(([driver, car]) => [
				driver,
				{
					x: car.X / UNITS_PER_METRE,
					y: car.Y / UNITS_PER_METRE,
					z: car.Z / UNITS_PER_METRE,
					status: car.Status
				}
			])
		)
	}));
}

function pedal(value: number | undefined): number {
	return value === undefined || value > PEDAL_MAX ? 0 : value;
}

/** The samples in a `CarData.z` payload; throws when it is not in the feed's format. */
export function decodeCarDataPayload(payload: string): CarDataSample[] {
	return parsePayload(carDataPayloadSchema, payload).Entries.map((entry) => ({
		at: Date.parse(entry.Utc),
		cars: new Map(
			Object.entries(entry.Cars).map(([driver, { Channels }]) => {
				const drs = Channels[CHANNEL.drs];

				return [
					driver,
					{
						rpm: Channels[CHANNEL.rpm] ?? 0,
						speedKph: Channels[CHANNEL.speed] ?? 0,
						gear: Channels[CHANNEL.gear] ?? 0,
						throttle: pedal(Channels[CHANNEL.throttle]),
						brake: Channels[CHANNEL.brake] === PEDAL_MAX,
						drsOpen: drs === undefined ? null : drs >= DRS_OPEN_FROM
					}
				];
			})
		)
	}));
}

export interface TelemetryStreams {
	/** In time order. */
	positions: PositionSample[];
	carData: CarDataSample[];
	/** Frames that did not match the feed's format. */
	skipped: number;
}

const payloadSchema = z.string();

/** Decodes the frames of both compressed topics; one that cannot be read is counted and left out. */
export function decodeTelemetryFrames(frames: readonly TopicFrame[]): TelemetryStreams {
	const streams: TelemetryStreams = { positions: [], carData: [], skipped: 0 };

	for (const frame of frames) {
		const payload = payloadSchema.safeParse(frame.data);

		try {
			if (!payload.success) {
				throw new Error(`${frame.topic} frame is not a string`);
			}

			if (frame.topic === POSITION_TOPIC) {
				streams.positions.push(...decodePositionPayload(payload.data));
			} else if (frame.topic === CAR_DATA_TOPIC) {
				streams.carData.push(...decodeCarDataPayload(payload.data));
			}
		} catch {
			streams.skipped += 1;
		}
	}

	streams.positions.sort((a, b) => a.at - b.at);
	streams.carData.sort((a, b) => a.at - b.at);

	return streams;
}
