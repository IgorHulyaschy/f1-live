import { z } from 'zod';

import { indexed, keyed } from '../sources/f1/decode.js';
import type { TopicFrame } from '../sources/f1/decode.js';

const timingSegmentsSchema = z
	.object({
		Lines: keyed(
			z
				.object({
					Sectors: indexed(
						z.object({ Segments: indexed(z.object({ Status: z.number() }).partial()) }).partial()
					)
				})
				.partial()
		)
	})
	.partial();

/** A car left a mini sector: the feed gave its segment a colour. */
export interface SegmentCompletion {
	driverNumber: string;
	/** From 0. */
	sector: number;
	/** From 0, within the sector. */
	segment: number;
	/** When the feed published it, ms since the Unix epoch. */
	at: number;
}

export interface TimingSegments {
	/** Segments in sector 1, 2 and 3 as the feed counts them. */
	perSector: [number, number, number];
	completions: SegmentCompletion[];
}

const TIMING_TOPIC = 'TimingData';

/**
 * The mini sectors of `TimingData`: how many each sector has, and when each car left each one.
 * A segment that goes from no colour to a colour is a car leaving it; a later change of colour,
 * as a time is beaten, is not. A frame that does not match the feed's format is left out.
 */
export function readSegments(frames: readonly TopicFrame[]): TimingSegments {
	const perSector: [number, number, number] = [0, 0, 0];
	const completions: SegmentCompletion[] = [];
	const colours = new Map<string, number>();

	for (const frame of frames) {
		const parsed = frame.topic === TIMING_TOPIC ? timingSegmentsSchema.safeParse(frame.data) : null;

		if (!parsed?.success) {
			continue;
		}

		for (const [driverNumber, line] of parsed.data.Lines ?? []) {
			for (const [sector, entry] of line.Sectors ?? []) {
				for (const [segment, { Status: status }] of entry.Segments ?? []) {
					if (sector < 3) {
						perSector[sector] = Math.max(perSector[sector] ?? 0, segment + 1);
					}

					const key = `${driverNumber}/${sector}/${segment}`;

					if (status === undefined) {
						continue;
					}

					const before = colours.get(key) ?? 0;

					if (status !== 0 && before === 0) {
						completions.push({ driverNumber, sector, segment, at: frame.timestamp });
					}

					// The first segment keeps its colour when it repeats the lap before, so it is
					// not sent again; the feed clears the second as the car leaves the first.
					if (status === 0 && before !== 0 && sector === 0 && segment === 1) {
						completions.push({ driverNumber, sector, segment: 0, at: frame.timestamp });
					}

					colours.set(key, status);
				}
			}
		}
	}

	return { perSector, completions };
}
