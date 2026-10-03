import type { Lap, LapIndexEntry, LapTelemetry, RaceSnapshot } from '@f1-live/shared';
import * as React from 'react';

import { useRace } from '@/data/race-context';
import { useLapTelemetry, useSessionTelemetry } from '@/data/telemetry-context';
import {
	bestLaps,
	type GapField,
	type GapPart,
	lapGapField,
	raceGapField,
	sectorGapFields,
	type SectorGapField,
	timedParts
} from '@/insights/gap-distance';
import { isKnockout } from '@/insights/qualifying';

/** Which field the straight shows: a part of qualifying, the session's best laps, or the race. */
export type GapView = 'best' | 'q1' | 'q2' | 'q3' | 'race';

/** A lap length for sessions whose circuit is not known yet: only estimates use it. */
const TYPICAL_LAP_M = 5000;

const PART_OF_VIEW: Record<Exclude<GapView, 'race'>, GapPart> = {
	best: 'best',
	q1: 1,
	q2: 2,
	q3: 3
};

/** The views a session offers, in key order. */
export function gapViews(snapshot: RaceSnapshot): GapView[] {
	if (snapshot.session.type === 'race' || snapshot.session.type === 'sprint') {
		return ['race', 'best'];
	}

	if (isKnockout(snapshot.session.type)) {
		const parts = timedParts(snapshot).map((part): GapView =>
			part === 1 ? 'q1' : part === 2 ? 'q2' : 'q3'
		);

		return [...parts, 'best'];
	}

	return ['best'];
}

/** The race, the last part of qualifying with times in it, or the session's best laps. */
export function defaultGapView(views: readonly GapView[]): GapView {
	if (views.includes('race')) {
		return 'race';
	}

	return views.findLast((view) => view !== 'best') ?? 'best';
}

export type GapFields = {
	field: GapField;
	/** Who loses where: the field in each sector; null in a race. */
	sectors: SectorGapField[] | null;
	/** The laps placed, so the ghost lap can run them. */
	laps: readonly Lap[];
	/** Telemetry for each placed lap that has it, by driver. */
	telemetry: ReadonlyMap<string, LapTelemetry>;
	lengthM: number;
	/** Laps still loading: their cars sit at their estimates until they arrive. */
	loading: boolean;
};

/**
 * The cars on the straight for a view of the session on screen: best laps by part with each
 * lap's telemetry, or the race by its gaps at the moment shown.
 */
export function useGapFields(view: GapView): GapFields {
	const { snapshot, standings } = useRace();
	const session = useSessionTelemetry();
	const ready = session.status === 'ready' ? session.value : null;
	const lengthM = ready?.circuit.lengthM ?? TYPICAL_LAP_M;

	const laps = React.useMemo(
		() => (view === 'race' ? [] : bestLaps(snapshot, PART_OF_VIEW[view])),
		[snapshot, view]
	);

	const entries = React.useMemo(
		(): LapIndexEntry[] =>
			ready
				? laps.flatMap((lap) =>
						ready.index.laps.filter(
							(entry) => entry.driverNumber === lap.driverNumber && entry.lap === lap.lap
						)
					)
				: [],
		[ready, laps]
	);

	const loaded = useLapTelemetry(entries);

	const telemetry = React.useMemo(() => {
		const byDriver = new Map<string, LapTelemetry>();

		for (const entry of entries) {
			const lap = loaded.get(entry.file);

			if (lap && !(lap instanceof Error)) {
				byDriver.set(entry.driverNumber, lap);
			}
		}

		return byDriver;
	}, [entries, loaded]);

	const lineSpeeds = React.useMemo(
		() =>
			new Map(
				(snapshot.personalBests ?? []).map((best) => [
					best.driverNumber,
					best.topSpeedsKph.finishLine
				])
			),
		[snapshot.personalBests]
	);

	return React.useMemo((): GapFields => {
		if (view === 'race') {
			return {
				field: raceGapField(standings, lengthM),
				sectors: null,
				laps: [],
				telemetry,
				lengthM,
				loading: false
			};
		}

		const boundaries = ready?.circuit.sectorBoundariesM ?? [lengthM / 3, (2 * lengthM) / 3];

		return {
			field: lapGapField(
				laps,
				(lap) => telemetry.get(lap.driverNumber) ?? null,
				(driverNumber) => lineSpeeds.get(driverNumber) ?? null,
				lengthM
			),
			sectors: sectorGapFields(laps, [
				boundaries[0],
				boundaries[1] - boundaries[0],
				lengthM - boundaries[1]
			]),
			laps,
			telemetry,
			lengthM,
			loading: session.status === 'loading' || entries.some((entry) => !loaded.has(entry.file))
		};
	}, [
		view,
		standings,
		lengthM,
		telemetry,
		ready,
		laps,
		lineSpeeds,
		session.status,
		entries,
		loaded
	]);
}

/** The first `count` cars of a field, or all of them. */
export function topOf(field: GapField, count: number | null): GapField {
	return count === null ? field : { ...field, cars: field.cars.slice(0, count) };
}
