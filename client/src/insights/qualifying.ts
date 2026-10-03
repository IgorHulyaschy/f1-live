import type { Lap, RaceSnapshot, SessionType } from '@f1-live/shared';

/** Sessions run on single best laps, ranked by time rather than by distance. */
export function isTimedSession(type: SessionType): boolean {
	return type !== 'race' && type !== 'sprint';
}

export function isKnockout(type: SessionType): boolean {
	return type === 'qualifying' || type === 'sprint_qualifying';
}

/** How long a timed session runs when nothing stops it, breaks between parts included. */
export function plannedMinutes(type: SessionType): number {
	return type === 'sprint_qualifying' ? 44 : 60;
}

/** The last part always runs with ten cars. */
const FINAL_PART_CARS = 10;

/**
 * Cars that go through to the second part: half of those beyond the final ten drop out in each
 * of the first two parts, so 15 of 20 and 16 of 22.
 */
export function secondPartCars(cars: number): number {
	return cars - Math.floor((cars - FINAL_PART_CARS) / 2);
}

/** When each part of a session started, from its status log: 1 part outside qualifying. */
export function partStarts(snapshot: RaceSnapshot): string[] {
	const starts: string[] = [];
	let previous: string | null = null;

	for (const change of snapshot.statusLog ?? []) {
		// A red flag aborts a part and the restart continues it.
		if (change.status === 'started' && previous !== 'started' && previous !== 'aborted') {
			starts.push(change.at);
		}

		previous = change.status;
	}

	return starts;
}

/** 1, 2 or 3 for the part a lap was set in; laps finished after a flag count for that part. */
export function partOfLap(lap: Lap, starts: readonly string[]): number {
	if (!lap.completedAt) {
		return 1;
	}

	const completed = lap.completedAt;

	return Math.max(1, starts.filter((start) => start <= completed).length);
}

const FINAL_STATUSES = new Set(['finalised', 'ended']);

export type QualifyingProgress = {
	/** The part running now, or the last one run; null when the status log is missing. */
	part: number | null;
	/** A part is running (a red flag included). */
	running: boolean;
	/** The classification is final. */
	finished: boolean;
};

export function qualifyingProgress(snapshot: RaceSnapshot): QualifyingProgress {
	const starts = partStarts(snapshot);
	const status = snapshot.status ?? 'inactive';
	const finished = FINAL_STATUSES.has(status) || (status === 'finished' && starts.length >= 3);

	return {
		part: starts.length > 0 ? Math.min(starts.length, 3) : null,
		running: status === 'started' || status === 'aborted',
		finished
	};
}

export type CutLine = {
	/** The line is drawn under this position. */
	after: number;
	label: string;
	/** Cars below it are out (not just in danger). */
	settled: boolean;
};

/**
 * The knockout lines of a qualifying tower: while a part runs, the drop zone under the cars that
 * go through; once it is over, who went out in it.
 */
export function cutLines(snapshot: RaceSnapshot, cars: number): CutLine[] {
	if (!isKnockout(snapshot.session.type) || cars <= FINAL_PART_CARS) {
		return [];
	}

	const prefix = snapshot.session.type === 'sprint_qualifying' ? 'SQ' : 'Q';
	const { part, running, finished } = qualifyingProgress(snapshot);
	const done = finished ? 3 : (part ?? 0) - (running ? 1 : 0);
	const secondCut = secondPartCars(cars);

	const first: CutLine =
		done >= 1
			? { after: secondCut, label: `Out in ${prefix}1`, settled: true }
			: { after: secondCut, label: `${prefix}1 drop zone`, settled: false };

	const second: CutLine =
		done >= 2
			? { after: FINAL_PART_CARS, label: `Out in ${prefix}2`, settled: true }
			: { after: FINAL_PART_CARS, label: `${prefix}2 drop zone`, settled: false };

	if (done >= 2 || (part === 2 && running)) {
		return [second, first];
	}

	return part === null && !finished ? [] : [first];
}
