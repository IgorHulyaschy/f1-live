import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EMPTY_SNAPSHOT, type Lap, type RaceSnapshot } from '@f1-live/shared';

import { laneShareOnInLap, stopExchanges } from './undercut.ts';
import { fixtureSession } from './test-fixtures.ts';

const race = fixtureSession('9858');

function lap(
	driverNumber: string,
	lapNumber: number,
	lapTimeMs: number,
	gapToLeaderMs: number
): Lap {
	return {
		driverNumber,
		lap: lapNumber,
		lapTimeMs,
		sectorTimesMs: [lapTimeMs / 3, lapTimeMs / 3, lapTimeMs / 3],
		position: driverNumber === 'A' ? 2 : 1,
		gapToLeaderMs,
		intervalMs: 0,
		compound: 'MEDIUM',
		tyreAge: lapNumber,
		pitIn: false,
		pitOut: false,
		trackStatus: 'green'
	};
}

/** 16 laps of 90 s, with a stop's in-lap and out-lap, and a second a lap quicker on new tyres. */
function lapTimes(stopLap: number, freshFrom: number): number[] {
	return Array.from({ length: 16 }, (_, index) => {
		const lapNumber = index + 1;

		return (
			90_000 +
			(lapNumber === stopLap ? 5000 : 0) +
			(lapNumber === stopLap + 1 ? 20_000 : 0) -
			(lapNumber >= freshFrom ? 1000 : 0)
		);
	});
}

/**
 * Two cars on 90 s laps, A a second behind B. A stops on lap 10 (in-lap +5 s, out-lap +20 s on a
 * 22 s pit lane) and runs a second a lap quicker on new tyres; B stops on lap 12 with the same
 * stop.
 */
function exchange(): RaceSnapshot {
	const a = lapTimes(10, 12);
	const b = lapTimes(12, 14);
	let totalA = 1000;
	let totalB = 0;
	const laps: Lap[] = [];

	for (let index = 0; index < 16; index++) {
		totalA += a[index] ?? 0;
		totalB += b[index] ?? 0;

		const leader = Math.min(totalA, totalB);

		laps.push(lap('A', index + 1, a[index] ?? 0, totalA - leader));
		laps.push(lap('B', index + 1, b[index] ?? 0, totalB - leader));
	}

	const ranked = laps.map((entry) => {
		const other = laps.find((row) => row.lap === entry.lap && row !== entry);

		return { ...entry, position: entry.gapToLeaderMs <= (other?.gapToLeaderMs ?? 0) ? 1 : 2 };
	});

	return {
		...EMPTY_SNAPSHOT,
		currentLap: 16,
		laps: ranked,
		pitStops: [
			{ driverNumber: 'A', lap: 10, laneTimeMs: 22_000 },
			{ driverNumber: 'B', lap: 12, laneTimeMs: 22_000 }
		]
	};
}

describe('stopExchanges', () => {
	it('adds the ledger up from the gap before to the gap after', () => {
		const [ledger] = stopExchanges(exchange());

		assert.ok(ledger);
		assert.equal(ledger.driverNumber, 'A');
		assert.equal(ledger.gapBeforeMs, 1000);
		assert.equal(ledger.outcome, 'gained');
		assert.equal(
			ledger.gapBeforeMs + ledger.steps.reduce((sum, step) => sum + step.ms, 0),
			ledger.gapAfterMs
		);
		// Same pit lane, so the stop costs nothing; two laps on new tyres turn +1 s into -1 s.
		assert.equal(ledger.steps.find((step) => step.label === 'Stop')?.ms, 0);
		assert.deepEqual(
			ledger.steps.map((step) => step.label),
			['In-lap', 'Stop', 'Out-lap', 'Rival in-lap', 'Rival out-lap']
		);
		assert.equal(ledger.gapAfterMs, -1000);
	});

	it('learns how a stop straddles the line from the in-laps and out-laps', () => {
		// +5 s on the in-lap and +20 s on the out-lap: a fifth of the stop is before the line.
		assert.ok(Math.abs(laneShareOnInLap(exchange()) - 0.2) < 0.01);
	});

	it('explains the 2025 Las Vegas stops: Piastri undercut Leclerc, Russell held Norris off', () => {
		const ledgers = stopExchanges(race);

		const find = (driverNumber: string, rivalNumber: string) =>
			ledgers.find(
				(ledger) => ledger.driverNumber === driverNumber && ledger.rivalNumber === rivalNumber
			);

		// Official stops: Piastri on lap 21, Leclerc on lap 24; Russell on lap 17, Norris on lap 22
		// (https://www.formula1.com/en/results/2025/races/1274/las-vegas/pit-stop-summary).
		const undercut = find('81', '16');
		const held = find('63', '4');

		assert.deepEqual(
			[undercut?.stopLap, undercut?.rivalStopLap, undercut?.outcome],
			[21, 24, 'gained']
		);
		assert.deepEqual([held?.stopLap, held?.rivalStopLap, held?.outcome], [17, 22, 'kept']);

		for (const ledger of ledgers) {
			const sum = ledger.gapBeforeMs + ledger.steps.reduce((total, step) => total + step.ms, 0);

			assert.ok(
				Math.abs(sum - ledger.gapAfterMs) < 1,
				`${ledger.driverNumber} on ${ledger.stopLap}`
			);
		}

		// Piastri's out-lap on new hards did most of it.
		const outLap = undercut?.steps.find((step) => step.label === 'Out-lap')?.ms ?? 0;

		assert.ok(outLap < -2000, `${outLap}`);
	});

	it('finds no exchange without stops', () => {
		assert.deepEqual(stopExchanges({ ...race, pitStops: [] }), []);
	});
});
