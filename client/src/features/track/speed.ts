import type { LapTelemetry } from '@f1-live/shared';
import { MAP_CHANNELS } from '@f1-live/shared/dashboard';

export const CHANNELS = MAP_CHANNELS;

export type Channel = (typeof CHANNELS)[number];

/** A stretch of the lap and the channel's value over it. */
export type ChannelStretch = { fromM: number; toM: number; value: number };

/** What a channel's values run between, for its colour scale. */
export type ChannelRange = { min: number; max: number };

function column(lap: LapTelemetry, channel: Channel): readonly number[] | undefined {
	return lap[channel];
}

/**
 * The lap cut into stretches of `stepM` with the channel's value in each, read at its middle
 * between the samples around it. Gear and brake are steps, so they take the nearest sample.
 */
export function channelAlong(lap: LapTelemetry, channel: Channel, stepM: number): ChannelStretch[] {
	const values = column(lap, channel);
	const { d } = lap;
	const end = d[d.length - 1] ?? 0;

	if (!values || values.length === 0 || end <= 0) {
		return [];
	}

	const stepped = channel === 'gear' || channel === 'brake';
	const stretches: ChannelStretch[] = [];
	let index = 0;

	const count = Math.ceil(end / stepM - 1e-9);

	for (let step = 0; step < count; step++) {
		const from = step * stepM;
		const to = Math.min(end, from + stepM);
		const middle = (from + to) / 2;

		while (index < d.length - 2 && (d[index + 1] ?? 0) < middle) {
			index++;
		}

		const d0 = d[index] ?? 0;
		const d1 = d[index + 1] ?? d0;
		const v0 = values[index] ?? 0;
		const v1 = values[index + 1] ?? v0;
		const share = d1 > d0 ? (middle - d0) / (d1 - d0) : 0;
		const value = stepped ? (share < 0.5 ? v0 : v1) : v0 + (v1 - v0) * share;

		stretches.push({ fromM: from, toM: to, value });
	}

	return stretches;
}

/** The scale a channel is drawn on: speed from the lap's slowest to fastest, the rest fixed. */
export function channelRange(channel: Channel, stretches: readonly ChannelStretch[]): ChannelRange {
	switch (channel) {
		case 'speed': {
			const values = stretches.map((stretch) => stretch.value);

			return { min: Math.min(...values), max: Math.max(...values) };
		}

		case 'gear':
			return { min: 1, max: 8 };
		case 'throttle':
			return { min: 0, max: 100 };
		case 'brake':
			return { min: 0, max: 1 };
	}
}

/** A place on the lap worth a label: the top speed, or the slowest point of a corner. */
export type SpeedMark = { distanceM: number; speed: number; kind: 'top' | 'corner' };

/** Corners closer than this count as one. */
const CORNER_GAP_M = 250;

/** A corner is a dip of at least this much below the speed either side of it. */
const CORNER_DIP_KPH = 40;

/**
 * The lap's top speed and its slowest corners: the lowest points of the speed trace, each well
 * below the speed around it. At most `corners` of them, slowest first.
 */
export function speedMarks(lap: LapTelemetry, corners: number): SpeedMark[] {
	const speed = lap.speed;

	if (!speed || speed.length === 0) {
		return [];
	}

	let top = 0;
	const minima: SpeedMark[] = [];

	speed.forEach((value, index) => {
		if (value > (speed[top] ?? 0)) {
			top = index;
		}

		const before = speed.slice(Math.max(0, index - 16), index);
		const after = speed.slice(index + 1, index + 17);

		if (
			before.length > 0 &&
			after.length > 0 &&
			before.every((other) => other >= value) &&
			after.every((other) => other >= value) &&
			Math.max(...before) - value > CORNER_DIP_KPH &&
			Math.max(...after) - value > CORNER_DIP_KPH
		) {
			minima.push({ distanceM: lap.d[index] ?? 0, speed: value, kind: 'corner' });
		}
	});

	const kept: SpeedMark[] = [];

	for (const corner of minima.toSorted((a, b) => a.speed - b.speed)) {
		if (kept.every((other) => Math.abs(other.distanceM - corner.distanceM) > CORNER_GAP_M)) {
			kept.push(corner);
		}
	}

	return [
		{ distanceM: lap.d[top] ?? 0, speed: speed[top] ?? 0, kind: 'top' },
		...kept.slice(0, corners)
	];
}
