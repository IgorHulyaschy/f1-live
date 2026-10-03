import type { Lap, PitStop, RaceSnapshot } from '@f1-live/shared';

import { isNeutralised, median, paceAround } from './clean-laps.ts';

/** Cars this close at the line before the first stop are fighting for the place. */
const GAP_WINDOW_MS = 5000;

/** A rival that answers within this many laps makes it an exchange; later is another race. */
const ANSWER_LAPS = 6;

/** Without stops to learn from, the pit lane is taken to straddle the line evenly. */
const DEFAULT_LANE_SHARE = 0.5;

export type ExchangeOutcome = 'gained' | 'lost' | 'kept' | 'stayed';

export interface LedgerStep {
	label: string;
	/** Time the first car lost to the rival in this phase; negative is time gained. */
	ms: number;
}

export interface StopExchange {
	/** The car that stopped first. */
	driverNumber: string;
	rivalNumber: string;
	stopLap: number;
	rivalStopLap: number;
	/** At the line before the first stop and after both out-laps; positive is behind the rival. */
	gapBeforeMs: number;
	gapAfterMs: number;
	/** In order, from the gap before to the gap after; they add up exactly. */
	steps: LedgerStep[];
	positionBefore: number;
	positionAfter: number;
	rivalPositionBefore: number;
	rivalPositionAfter: number;
	outcome: ExchangeOutcome;
	/** A stop came under a Virtual Safety Car or a Safety Car, so it cost less than usual. */
	neutralised: boolean;
}

type LapBook = Map<string, Map<number, Lap>>;

function lapBook(snapshot: RaceSnapshot): LapBook {
	const book: LapBook = new Map();

	for (const lap of snapshot.laps) {
		const own = book.get(lap.driverNumber) ?? new Map<number, Lap>();

		own.set(lap.lap, lap);
		book.set(lap.driverNumber, own);
	}

	return book;
}

/**
 * How much of a stop's pit lane time falls in the in-lap: the line crosses the pit lane, so the
 * rest falls in the out-lap. Learnt from the session's green stops, from how much slower each
 * in-lap and out-lap was than the driver's normal pace.
 */
export function laneShareOnInLap(snapshot: RaceSnapshot): number {
	const book = lapBook(snapshot);

	const shares = snapshot.pitStops.flatMap((stop) => {
		const own = book.get(stop.driverNumber);
		const inLap = own?.get(stop.lap);
		const outLap = own?.get(stop.lap + 1);
		const pace = own ? paceAround([...own.values()], stop.lap) : null;

		if (!inLap || !outLap || pace === null || inLap.trackStatus !== 'green') {
			return [];
		}

		const inExcess = inLap.lapTimeMs - pace;
		const outExcess = outLap.lapTimeMs - pace;

		return inExcess >= 0 && outExcess > 0 ? [inExcess / (inExcess + outExcess)] : [];
	});

	return median(shares) ?? DEFAULT_LANE_SHARE;
}

/** Names each lap of the exchange by what happened on it. */
function phaseLabel(lap: number, first: PitStop, second: PitStop): string {
	const parts = [
		lap === first.lap ? 'in-lap' : lap === first.lap + 1 ? 'out-lap' : null,
		lap === second.lap ? 'rival in-lap' : lap === second.lap + 1 ? 'rival out-lap' : null
	].filter((part) => part !== null);

	return parts.length === 0 ? 'laps between' : parts.join(', ');
}

function capitalised(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Each pit stop exchange: a car stops, the car just ahead or behind it (within five seconds)
 * answers within six laps, and the ledger shows where the time went. Each lap's difference is
 * split into driving and pit lane: the pit lane time of each car comes out of its in- and
 * out-lap and is shown on its own as the stop.
 */
export function stopExchanges(snapshot: RaceSnapshot): StopExchange[] {
	const book = lapBook(snapshot);
	const share = laneShareOnInLap(snapshot);
	const exchanges: StopExchange[] = [];

	const stopsOf = (driverNumber: string) =>
		snapshot.pitStops
			.filter((stop) => stop.driverNumber === driverNumber)
			.toSorted((a, b) => a.lap - b.lap);

	const laneIn = (stop: PitStop, lap: number) =>
		lap === stop.lap
			? stop.laneTimeMs * share
			: lap === stop.lap + 1
				? stop.laneTimeMs * (1 - share)
				: 0;

	for (const first of snapshot.pitStops) {
		const before = book.get(first.driverNumber)?.get(first.lap - 1);

		if (!before) {
			continue;
		}

		const neighbours = snapshot.laps.filter(
			(lap) =>
				lap.lap === before.lap &&
				Math.abs(lap.position - before.position) === 1 &&
				Math.abs(lap.gapToLeaderMs - before.gapToLeaderMs) <= GAP_WINDOW_MS
		);

		for (const rivalBefore of neighbours) {
			const second = stopsOf(rivalBefore.driverNumber).find(
				(stop) => stop.lap >= first.lap && stop.lap <= first.lap + ANSWER_LAPS
			);

			// A same-lap pair is counted once, from the car behind.
			if (!second || (second.lap === first.lap && rivalBefore.position > before.position)) {
				continue;
			}

			const endLap = Math.max(first.lap, second.lap) + 1;
			const own = book.get(first.driverNumber);
			const rival = book.get(rivalBefore.driverNumber);
			const after = own?.get(endLap);
			const rivalAfter = rival?.get(endLap);

			if (!own || !rival || !after || !rivalAfter) {
				continue;
			}

			const steps: LedgerStep[] = [];
			let complete = true;

			for (let lap = first.lap; lap <= endLap; lap++) {
				const mine = own.get(lap);
				const theirs = rival.get(lap);

				if (!mine || !theirs) {
					complete = false;
					break;
				}

				const driving =
					mine.lapTimeMs - laneIn(first, lap) - (theirs.lapTimeMs - laneIn(second, lap));

				const label = capitalised(phaseLabel(lap, first, second));
				const last = steps.at(-1);

				if (label === 'Laps between' && last?.label === label) {
					last.ms += driving;
				} else {
					steps.push({ label, ms: driving });
				}

				if (lap === first.lap) {
					steps.push({ label: 'Stop', ms: first.laneTimeMs - second.laneTimeMs });
				}
			}

			if (!complete) {
				continue;
			}

			const gapBeforeMs = before.gapToLeaderMs - rivalBefore.gapToLeaderMs;
			const behindBefore = before.position > rivalBefore.position;
			const behindAfter = after.position > rivalAfter.position;

			exchanges.push({
				driverNumber: first.driverNumber,
				rivalNumber: rivalBefore.driverNumber,
				stopLap: first.lap,
				rivalStopLap: second.lap,
				gapBeforeMs,
				gapAfterMs: after.gapToLeaderMs - rivalAfter.gapToLeaderMs,
				steps,
				positionBefore: before.position,
				positionAfter: after.position,
				rivalPositionBefore: rivalBefore.position,
				rivalPositionAfter: rivalAfter.position,
				outcome: behindBefore ? (behindAfter ? 'stayed' : 'gained') : behindAfter ? 'lost' : 'kept',
				neutralised: [first.lap, first.lap + 1, second.lap, second.lap + 1].some(
					(lap) => isNeutralised(own.get(lap)) || isNeutralised(rival.get(lap))
				)
			});
		}
	}

	return exchanges.toSorted((a, b) => a.stopLap - b.stopLap || a.positionBefore - b.positionBefore);
}
