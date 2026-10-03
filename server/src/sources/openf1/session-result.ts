import { readFile } from 'node:fs/promises';

import type { ClassificationCorrectionEvent, Standing } from '@f1-live/shared';
import { z } from 'zod';

import type { CorrectionSource, CorrectionTarget } from '../../import/corrections.js';
import { openF1CacheOf } from '../../sinks/files.js';

/** History is free and needs no key; the terms for commercial use are an open organisational item. */
export const OPENF1_URL = 'https://api.openf1.org/v1';

const sessionResultSchema = z.array(
	z.object({
		session_key: z.number(),
		driver_number: z.number(),
		dsq: z.boolean(),
		number_of_laps: z.number().nullable(),
		/** Race time in seconds, penalties included; none for a lapped or retired car, and a list in qualifying. */
		duration: z.union([z.number(), z.array(z.number().nullable())]).nullable()
	})
);

export type SessionResultRow = z.output<typeof sessionResultSchema>[number];

export function parseSessionResult(text: string): SessionResultRow[] {
	return sessionResultSchema.parse(JSON.parse(text));
}

/** Penalties come in whole seconds; a difference further from one than this is not a penalty. */
const WHOLE_SECOND_TOLERANCE_MS = 300;

interface Timed {
	driverNumber: string;
	/** The official race time less the reference car's, in milliseconds. */
	officialMs: number;
	/** The feed's gap less the reference car's. */
	feedMs: number;
}

/** Cars with an official race time and a gap in the feed on the same lap, in the feed's order. */
function timedCars(rows: readonly SessionResultRow[], standings: readonly Standing[]): Timed[] {
	const cars = standings.flatMap((standing) => {
		const row = rows.find((candidate) => String(candidate.driver_number) === standing.driverNumber);
		const seconds = row?.duration ?? null;

		if (
			row === undefined ||
			row.dsq ||
			seconds === null ||
			Array.isArray(seconds) ||
			standing.gapToLeaderMs === null ||
			row.number_of_laps !== standing.lapsCompleted
		) {
			return [];
		}

		return [{ driverNumber: standing.driverNumber, seconds, gapMs: standing.gapToLeaderMs }];
	});

	const [reference] = cars;

	return cars.map((car) => ({
		driverNumber: car.driverNumber,
		officialMs: Math.round((car.seconds - (reference?.seconds ?? 0)) * 1000),
		feedMs: car.gapMs - (reference?.gapMs ?? 0)
	}));
}

/** The most common value; the smallest in size when several are, so no penalty is the default. */
function mostCommon(values: readonly number[]): number {
	const counts = new Map<number, number>();

	for (const value of values) {
		counts.set(value, (counts.get(value) ?? 0) + 1);
	}

	return (
		[...counts].toSorted((a, b) => b[1] - a[1] || Math.abs(a[0]) - Math.abs(b[0]))[0]?.[0] ?? 0
	);
}

/**
 * Whole seconds the official race time of each car differs from the feed's final order by: a
 * time penalty applied after the feed ended, or negative when a penalty it applied was
 * withdrawn. Differences are taken against the most common one, so a penalised winner, which
 * shifts every gap, shows as his own penalty only.
 */
function timePenalties(
	rows: readonly SessionResultRow[],
	standings: readonly Standing[]
): { driverNumber: string; seconds: number }[] {
	const cars = timedCars(rows, standings).map((car) => ({
		driverNumber: car.driverNumber,
		differenceMs: car.officialMs - car.feedMs
	}));

	const common = mostCommon(cars.map((car) => Math.round(car.differenceMs / 1000)));

	return cars.flatMap((car) => {
		const extraMs = car.differenceMs - common * 1000;
		const seconds = Math.round(extraMs / 1000);
		const isWholeSeconds = Math.abs(extraMs - seconds * 1000) <= WHOLE_SECOND_TOLERANCE_MS;

		return seconds !== 0 && isWholeSeconds ? [{ driverNumber: car.driverNumber, seconds }] : [];
	});
}

/**
 * What the official result says that the feed's own final order does not: disqualifications, and
 * time penalties applied or withdrawn after the feed ended. OpenF1 gives no reason or time.
 */
export function correctionsFromResult(
	rows: readonly SessionResultRow[],
	standings: readonly Standing[],
	endedAt: string
): ClassificationCorrectionEvent[] {
	const events: ClassificationCorrectionEvent[] = [];

	for (const row of rows.filter((candidate) => candidate.dsq)) {
		events.push({
			kind: 'classification_correction',
			at: endedAt,
			correction: {
				driverNumber: String(row.driver_number),
				kind: 'disqualified',
				reason: 'Disqualified, as the OpenF1 session result lists it'
			}
		});
	}

	for (const { driverNumber, seconds } of timePenalties(rows, standings)) {
		events.push({
			kind: 'classification_correction',
			at: endedAt,
			correction: {
				driverNumber,
				kind: 'time_penalty',
				seconds,
				reason:
					seconds > 0
						? 'Time penalty added to the race time, as the OpenF1 session result shows'
						: 'Time penalty withdrawn, as the OpenF1 session result shows'
			}
		});
	}

	return events.toSorted(
		(a, b) =>
			Number(a.correction.driverNumber) - Number(b.correction.driverNumber) ||
			a.correction.kind.localeCompare(b.correction.kind)
	);
}

/** Reads the session result the import saved at `openF1CacheOf`; none when it saved nothing. */
export class OpenF1Corrections implements CorrectionSource {
	private readonly dataDir: string;

	constructor(dataDir: string) {
		this.dataDir = dataDir;
	}

	async load({
		key,
		endedAt,
		standings
	}: CorrectionTarget): Promise<ClassificationCorrectionEvent[]> {
		const text = await readFile(openF1CacheOf(this.dataDir, key), 'utf8').catch(
			(error: NodeJS.ErrnoException) => {
				if (error.code === 'ENOENT') {
					return null;
				}

				throw error;
			}
		);

		return text === null ? [] : correctionsFromResult(parseSessionResult(text), standings, endedAt);
	}
}
