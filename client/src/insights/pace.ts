import type { Driver, Lap, RaceSnapshot, Stint, TyreCompound } from '@f1-live/shared';

import { plural } from '../lib/format.ts';
import { average, fuelCorrectedSeconds, isCleanLap, median } from './clean-laps.ts';
import { compoundShifter, stintPaces } from './tyre-pace.ts';

/** Which laps count: all of them, one stint of each driver, or the last few of the session. */
export type PaceSpan =
	{ kind: 'race' } | { kind: 'stint'; stint: number } | { kind: 'last'; laps: number };

export type PaceFilter = { span: PaceSpan; compound: TyreCompound | null };

export const WHOLE_RACE: PaceFilter = { span: { kind: 'race' }, compound: null };

/** Fewer clean laps than this say nothing about a driver's pace. */
export const MIN_PACE_LAPS = 3;

/** A lap gap smaller than this, per lap, is matched pace. */
export const MATCHED_SECONDS = 0.05;

export const COMPOUND_NAME: Record<TyreCompound, string> = {
	SOFT: 'Soft',
	MEDIUM: 'Medium',
	HARD: 'Hard',
	INTERMEDIATE: 'Intermediate',
	WET: 'Wet',
	UNKNOWN: 'Unknown'
};

/** Wet tyres run on another surface, so their laps say nothing about pace against slicks. */
const isWetCompound = (compound: TyreCompound) => compound === 'INTERMEDIATE' || compound === 'WET';

export interface PaceEntry {
	driver: Driver;
	/**
	 * Median of the clean laps in the span with the fuel burnt, the tyre age and the compound taken
	 * out: seconds a lap as if on a new hard set with an empty tank. Only the gaps mean anything.
	 */
	paceSeconds: number;
	/** Seconds a lap slower than the quickest driver in the same list; 0 for that driver. */
	deltaToBestSeconds: number;
	/** The clean laps it was computed from, in order. */
	laps: readonly Lap[];
	/** Compounds those laps were on, most laps first. */
	compounds: readonly TyreCompound[];
	/** Lap time lost per lap of tyre age on those stints; null when no stint had enough laps to fit. */
	fadeSecondsPerLap: number | null;
}

export interface PaceVersus {
	first: PaceEntry | null;
	second: PaceEntry | null;
	/** The quicker driver on the laps both drove clean, else on corrected pace; null when level or either has no pace. */
	faster: Driver | null;
	/** Seconds a lap the second driver was quicker; negative when slower. */
	gainSeconds: number | null;
	/** The same on the laps both drove clean in the span, uncorrected: a check on the verdict. */
	sameLaps: { laps: number; gainSeconds: number } | null;
	text: string;
}

export interface TeammateGap {
	team: string;
	quicker: PaceEntry;
	slower: PaceEntry;
	gapSeconds: number;
}

/** "over the race", "in stint 2", "over the last 10 laps", with the compound when filtered. */
export function paceSpanText({ span, compound }: PaceFilter): string {
	const tyre = compound === null ? '' : ` on ${COMPOUND_NAME[compound]} tyres`;

	switch (span.kind) {
		case 'race': {
			return `over the race${tyre}`;
		}

		case 'stint': {
			return `in stint ${span.stint}${tyre}`;
		}

		case 'last': {
			return `over the last ${plural(span.laps, 'lap')}${tyre}`;
		}
	}
}

function stintOf(stints: readonly Stint[], lap: Lap): Stint | undefined {
	return stints.find(
		(stint) =>
			stint.driverNumber === lap.driverNumber &&
			lap.lap >= stint.startLap &&
			lap.lap <= stint.endLap
	);
}

/**
 * Pace of every driver over any span, built once per snapshot: the stint fits and compound gaps
 * are the field's, so a filter changes the laps counted and nothing else.
 */
export function createPace(snapshot: RaceSnapshot) {
	const { totalLaps } = snapshot.session;
	const fits = stintPaces(snapshot);
	const { shift, applied: compoundsEvened } = compoundShifter(fits);

	// The field's own slope for a compound, the same for every driver on it, floored at zero: a
	// tyre does not get quicker with age, and a fit that says so is the track rubbering in or fuel
	// burning faster than assumed. One slope for all, so a ranking and a comparison never disagree
	// because one driver's fit was floored and another's was not.
	const slopeOn = (compound: TyreCompound) =>
		Math.max(
			median(
				fits.flatMap((fit) => (fit.compound === compound ? [fit.degradationSecondsPerLap] : []))
			) ?? 0,
			0
		);

	const fitOf = (lap: Lap) => {
		const stint = stintOf(snapshot.stints, lap);

		return stint
			? fits.find((fit) => fit.driverNumber === lap.driverNumber && fit.stint === stint.stint)
			: undefined;
	};

	// Laps on wet tyres count only when asked for, or when the session had no lap on slicks.
	const dryRan = snapshot.laps.some((lap) => isCleanLap(lap) && !isWetCompound(lap.compound));

	const inSpan = (lap: Lap, span: PaceSpan): boolean => {
		switch (span.kind) {
			case 'race': {
				return true;
			}

			case 'stint': {
				return stintOf(snapshot.stints, lap)?.stint === span.stint;
			}

			case 'last': {
				return lap.lap > snapshot.currentLap - span.laps;
			}
		}
	};

	const lapsOf = (driverNumber: string, { span, compound }: PaceFilter): Lap[] =>
		snapshot.laps.filter(
			(lap) =>
				lap.driverNumber === driverNumber &&
				isCleanLap(lap) &&
				(compound === null ? !dryRan || !isWetCompound(lap.compound) : lap.compound === compound) &&
				inSpan(lap, span)
		);

	const entries = ({ span, compound }: PaceFilter): PaceEntry[] => {
		const found = snapshot.drivers.flatMap((driver): Omit<PaceEntry, 'deltaToBestSeconds'>[] => {
			const laps = lapsOf(driver.number, { span, compound });

			const corrected = laps.map((lap) => {
				return (
					fuelCorrectedSeconds(lap, totalLaps) -
					slopeOn(lap.compound) * lap.tyreAge -
					shift(lap.compound)
				);
			});

			const pace = median(corrected);

			if (pace === null || laps.length < MIN_PACE_LAPS) {
				return [];
			}

			const counts = new Map<TyreCompound, number>();

			for (const lap of laps) {
				counts.set(lap.compound, (counts.get(lap.compound) ?? 0) + 1);
			}

			return [
				{
					driver,
					paceSeconds: pace,
					laps,
					compounds: [...counts.keys()].toSorted(
						(a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)
					),
					fadeSecondsPerLap: average(
						laps.flatMap((lap) => fitOf(lap)?.degradationSecondsPerLap ?? [])
					)
				}
			];
		});

		const best = Math.min(...found.map((entry) => entry.paceSeconds));

		return found
			.map((entry) => ({ ...entry, deltaToBestSeconds: entry.paceSeconds - best }))
			.toSorted((a, b) => a.deltaToBestSeconds - b.deltaToBestSeconds);
	};

	// Fuel, tyre age and compound taken out against one reference tyre age.
	const levelled = (lap: Lap, referenceAge: number) =>
		fuelCorrectedSeconds(lap, totalLaps) -
		slopeOn(lap.compound) * (lap.tyreAge - referenceAge) -
		shift(lap.compound);

	/**
	 * Two drivers on equal terms: both corrected with the field's slope for their compound, brought
	 * to the mean tyre age of the laps compared, so equal ages and fuel cancel and only the compound
	 * offset is left. On the laps both drove clean the laps are compared one for one. Seconds a lap
	 * the second driver is quicker; null when either has too few clean laps.
	 */
	const pair = (
		firstNumber: string,
		secondNumber: string,
		filter: PaceFilter
	): { gainSeconds: number; sameLaps: PaceVersus['sameLaps'] } | null => {
		const one = lapsOf(firstNumber, filter);
		const two = lapsOf(secondNumber, filter);

		if (one.length < MIN_PACE_LAPS || two.length < MIN_PACE_LAPS) {
			return null;
		}

		const theirs = new Map(two.map((lap) => [lap.lap, lap]));

		const together = one.flatMap((lap) => {
			const other = theirs.get(lap.lap);

			return other ? [{ lap, other }] : [];
		});

		if (together.length >= MIN_PACE_LAPS) {
			const referenceAge =
				average(together.flatMap(({ lap, other }) => [lap.tyreAge, other.tyreAge])) ?? 0;

			return {
				gainSeconds:
					median(
						together.map(
							({ lap, other }) => levelled(lap, referenceAge) - levelled(other, referenceAge)
						)
					) ?? 0,
				sameLaps: {
					laps: together.length,
					gainSeconds:
						median(together.map(({ lap, other }) => (lap.lapTimeMs - other.lapTimeMs) / 1000)) ?? 0
				}
			};
		}

		const referenceAge = average([...one, ...two].map((lap) => lap.tyreAge)) ?? 0;

		return {
			gainSeconds:
				(median(one.map((lap) => levelled(lap, referenceAge))) ?? 0) -
				(median(two.map((lap) => levelled(lap, referenceAge))) ?? 0),
			sameLaps: null
		};
	};

	return { entries, pair, compoundsEvened };
}

/** Every driver ranked by corrected pace over the span, quickest first. */
export function racePace(snapshot: RaceSnapshot, filter: PaceFilter = WHOLE_RACE): PaceEntry[] {
	return createPace(snapshot).entries(filter);
}

function compoundsOf(entry: PaceEntry): string {
	return entry.compounds.map((compound) => COMPOUND_NAME[compound]).join(' and ');
}

/**
 * Two drivers over one span, on corrected pace, with the laps each verdict used. The same laps
 * both drove clean, uncorrected, are kept beside it as a check.
 */
export function paceVersus(
	snapshot: RaceSnapshot,
	firstNumber: string,
	secondNumber: string,
	filter: PaceFilter = WHOLE_RACE
): PaceVersus | null {
	const first = snapshot.drivers.find((driver) => driver.number === firstNumber);
	const second = snapshot.drivers.find((driver) => driver.number === secondNumber);

	if (!first || !second || first === second) {
		return null;
	}

	const pace = createPace(snapshot);
	const ranked = pace.entries(filter);
	const firstEntry = ranked.find((entry) => entry.driver === first) ?? null;
	const secondEntry = ranked.find((entry) => entry.driver === second) ?? null;
	const where = paceSpanText(filter);

	if (!firstEntry || !secondEntry) {
		const missing = [firstEntry ? null : first, secondEntry ? null : second].flatMap(
			(driver) => driver?.code ?? []
		);

		return {
			first: firstEntry,
			second: secondEntry,
			faster: null,
			gainSeconds: null,
			sameLaps: null,
			text: `Too few clean laps for ${missing.join(' and ')} ${where} to compare pace.`
		};
	}

	const compared = pace.pair(firstNumber, secondNumber, filter);
	const gain = compared?.gainSeconds ?? 0;
	const sameLaps = compared?.sameLaps ?? null;

	const likeMatched = sameLaps !== null && Math.abs(sameLaps.gainSeconds) < MATCHED_SECONDS;
	const matched = Math.abs(gain) < MATCHED_SECONDS;
	const quick = gain > 0 ? second : first;

	// Like for like leads: the laps both drove clean, uncorrected. The corrected gap follows.
	const lead = sameLaps && !likeMatched ? (sameLaps.gainSeconds > 0 ? second : first) : null;

	const faster = lead ?? (matched ? null : quick);

	return {
		first: firstEntry,
		second: secondEntry,
		faster,
		gainSeconds: gain,
		sameLaps,
		text: versusText({
			first,
			second,
			firstEntry,
			secondEntry,
			sameLaps,
			gain,
			where,
			evened: pace.compoundsEvened
		})
	};
}

function versusText({
	first,
	second,
	firstEntry,
	secondEntry,
	sameLaps,
	gain,
	where,
	evened
}: {
	first: Driver;
	second: Driver;
	firstEntry: PaceEntry;
	secondEntry: PaceEntry;
	sameLaps: PaceVersus['sameLaps'];
	gain: number;
	where: string;
	evened: boolean;
}): string {
	const [one, two] = [compoundsOf(firstEntry), compoundsOf(secondEntry)];
	const [quick, slow] = gain > 0 ? [second, first] : [first, second];
	const size = Math.abs(gain).toFixed(2);
	const tyres = `${first.code}'s ${one} against ${second.code}'s ${two}`;

	const allowing =
		one === two
			? `allowing for tyre age (both on ${one})`
			: evened
				? `allowing for ${tyres}`
				: `allowing for tyre age but not for ${tyres}`;

	if (!sameLaps) {
		return Math.abs(gain) < MATCHED_SECONDS
			? `${first.code} and ${second.code} were level ${where}, ${allowing}, with no laps both drove clean to check.`
			: `${quick.code} was ${size} s a lap quicker than ${slow.code} ${where}, ${allowing}, with no laps both drove clean to check.`;
	}

	const [front, back] = sameLaps.gainSeconds > 0 ? [second, first] : [first, second];

	const like =
		Math.abs(sameLaps.gainSeconds) < MATCHED_SECONDS
			? `${first.code} and ${second.code} were level ${where} on the ${plural(sameLaps.laps, 'lap')} both drove clean`
			: `${front.code} was ${Math.abs(sameLaps.gainSeconds).toFixed(2)} s a lap quicker than ${back.code} ${where} on the ${plural(sameLaps.laps, 'lap')} both drove clean`;

	const corrected =
		Math.abs(gain) < MATCHED_SECONDS
			? `${allowing}, the two are level`
			: Math.sign(sameLaps.gainSeconds) === Math.sign(gain)
				? `${allowing}, ${size} s`
				: `${allowing}, ${quick.code} was ${size} s quicker`;

	const apart =
		sameLaps.laps < Math.min(firstEntry.laps.length, secondEntry.laps.length)
			? ` The two cover different laps: ${firstEntry.laps.length} clean laps for ${first.code}, ${secondEntry.laps.length} for ${second.code}.`
			: '';

	return `${like}; ${corrected}.${apart}`;
}

/** Each stint number both drivers ran, with their pace in it: the pairs the verdict is made of. */
export function stintPairs(
	snapshot: RaceSnapshot,
	firstNumber: string,
	secondNumber: string,
	compound: TyreCompound | null = null
) {
	const pace = createPace(snapshot);
	const numbers = new Set(snapshot.stints.map((stint) => stint.stint));

	return [...numbers]
		.toSorted((a, b) => a - b)
		.flatMap((stint) => {
			const ranked = pace.entries({ span: { kind: 'stint', stint }, compound });
			const first = ranked.find((entry) => entry.driver.number === firstNumber) ?? null;
			const second = ranked.find((entry) => entry.driver.number === secondNumber) ?? null;

			const gain =
				first && second
					? (pace.pair(firstNumber, secondNumber, { span: { kind: 'stint', stint }, compound })
							?.gainSeconds ?? null)
					: null;

			return first || second ? [{ stint, first, second, gainSeconds: gain }] : [];
		});
}

/** Each team whose two drivers both have pace, the biggest gap first. */
export function teammateGaps(
	snapshot: RaceSnapshot,
	filter: PaceFilter = WHOLE_RACE
): TeammateGap[] {
	const pace = createPace(snapshot);
	const ranked = pace.entries(filter);
	const teams = [...new Set(ranked.map((entry) => entry.driver.team))];

	return teams
		.flatMap((team): TeammateGap[] => {
			const [quicker, slower] = ranked.filter((entry) => entry.driver.team === team);

			const gain =
				quicker && slower
					? pace.pair(quicker.driver.number, slower.driver.number, filter)?.gainSeconds
					: undefined;

			if (!quicker || !slower || gain === undefined) {
				return [];
			}

			// The comparison settles who is ahead: the ranking mixes each driver's own fits.
			return gain > 0
				? [{ team, quicker: slower, slower: quicker, gapSeconds: gain }]
				: [{ team, quicker, slower, gapSeconds: -gain }];
		})
		.toSorted((a, b) => b.gapSeconds - a.gapSeconds);
}

/** The spans worth offering: the whole session, each stint number any driver ran, the last 10 laps. */
export function paceSpans(snapshot: RaceSnapshot): PaceSpan[] {
	const stints = [...new Set(snapshot.stints.map((stint) => stint.stint))]
		.toSorted((a, b) => a - b)
		.slice(0, MAX_STINT_SPANS);

	return [
		{ kind: 'race' },
		...stints.map((stint): PaceSpan => ({ kind: 'stint', stint })),
		{ kind: 'last', laps: LAST_LAPS }
	];
}

const MAX_STINT_SPANS = 4;

export const LAST_LAPS = 10;

/** Compounds any stint ran, hardest first as a pit wall lists them. */
export function compoundsRun(snapshot: RaceSnapshot): TyreCompound[] {
	const order: TyreCompound[] = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'];
	const run = new Set(snapshot.stints.map((stint) => stint.compound));

	return order.filter((compound) => run.has(compound));
}
