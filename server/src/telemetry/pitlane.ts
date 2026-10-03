import { projectToTrack } from '@f1-live/shared';
import type { PitLane, Point, TrackOutline } from '@f1-live/shared';

import { lowerBound } from './series.js';
import type { PositionTrack } from './series.js';

/** A car went down the pit lane: in when the feed said it entered, out when it said it left. */
export interface PitPass {
	driverNumber: string;
	entryAt: number;
	exitAt: number;
}

/** A pass shorter than this was not a pit lane; one longer than this stopped in a garage. */
const MIN_PASS_MS = 8000;

const MAX_PASS_MS = 60_000;

/** Samples closer than this say the car stood still. */
const MIN_SPACING_M = 1;

const MIN_POINTS = 8;

const MIN_LENGTH_M = 100;

const SMOOTHING_RADIUS = 1;

function smoothOpen(points: readonly Point[]): Point[] {
	return points.map((_, index) => {
		const from = Math.max(0, index - SMOOTHING_RADIUS);
		const to = Math.min(points.length - 1, index + SMOOTHING_RADIUS);
		let x = 0;
		let y = 0;

		for (let near = from; near <= to; near += 1) {
			x += points[near]?.[0] ?? 0;
			y += points[near]?.[1] ?? 0;
		}

		return index === 0 || index === points.length - 1
			? (points[index] ?? [0, 0])
			: [x / (to - from + 1), y / (to - from + 1)];
	});
}

function laneOf(track: PositionTrack, from: number, to: number): Point[] {
	const points: Point[] = [];

	for (let index = lowerBound(track.at, from); index < track.at.length; index += 1) {
		if ((track.at[index] ?? 0) > to) {
			break;
		}

		const point: Point = [track.x[index] ?? 0, track.y[index] ?? 0];
		const last = points.at(-1);

		if (last === undefined || Math.hypot(point[0] - last[0], point[1] - last[1]) >= MIN_SPACING_M) {
			points.push(point);
		}
	}

	return points;
}

function lengthOf(points: readonly Point[]): number {
	return points.reduce((sum, point, index) => {
		const before = points[index - 1];

		return before === undefined ? 0 : sum + Math.hypot(point[0] - before[0], point[1] - before[1]);
	}, 0);
}

/**
 * The pit lane, from the quickest pass through it: the car does not stop, so its positions are
 * the lane. The feed publishes the entry and exit late by `latencyMs`.
 */
export function buildPitLane(
	outline: TrackOutline,
	tracks: ReadonlyMap<string, PositionTrack>,
	passes: readonly PitPass[],
	latencyMs: number
): PitLane | null {
	const candidates = passes
		.filter((pass) => {
			const duration = pass.exitAt - pass.entryAt;

			return duration >= MIN_PASS_MS && duration <= MAX_PASS_MS;
		})
		.toSorted((a, b) => a.exitAt - a.entryAt - (b.exitAt - b.entryAt));

	for (const pass of candidates) {
		const track = tracks.get(pass.driverNumber);

		const raw =
			track === undefined ? [] : laneOf(track, pass.entryAt - latencyMs, pass.exitAt - latencyMs);

		const points = smoothOpen(raw);
		const [first, last] = [points[0], points.at(-1)];

		if (
			first !== undefined &&
			last !== undefined &&
			points.length >= MIN_POINTS &&
			lengthOf(points) >= MIN_LENGTH_M
		) {
			return {
				points: points.map(([x, y]): Point => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]),
				entryM: Math.round(projectToTrack(outline, first[0], first[1]).distanceM * 10) / 10,
				exitM: Math.round(projectToTrack(outline, last[0], last[1]).distanceM * 10) / 10
			};
		}
	}

	return null;
}
