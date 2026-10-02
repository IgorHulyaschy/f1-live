import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { snapshotAtLap } from '../snapshot-at-lap.ts';
import { REFERENCE_RESULTS } from './las-vegas-2025.ts';
import { simulateLasVegas2025 } from './simulate-race.ts';

const race = simulateLasVegas2025();

describe('simulateLasVegas2025', () => {
	it('is deterministic', () => {
		assert.deepEqual(simulateLasVegas2025(), race);
	});

	it('reproduces the real classification and gaps at the flag', () => {
		const finalLaps = race.laps.filter((lap) => lap.lap === 50);
		const finishers = REFERENCE_RESULTS.filter((result) => result.gapSeconds !== null);

		for (const [index, result] of finishers.entries()) {
			const lap = finalLaps.find((entry) => entry.driverNumber === result.driverNumber);

			assert.equal(lap?.position, index + 1, `position of car ${result.driverNumber}`);
			assert.ok(
				Math.abs((lap?.gapToLeaderMs ?? 0) / 1000 - (result.gapSeconds ?? 0)) < 0.01,
				`gap of car ${result.driverNumber}`
			);
		}
	});

	it('keeps lap counts and retirements from the reference data', () => {
		for (const result of REFERENCE_RESULTS) {
			const laps = race.laps.filter((lap) => lap.driverNumber === result.driverNumber);

			assert.equal(laps.length, result.lapsCompleted, `laps of car ${result.driverNumber}`);
		}

		assert.deepEqual(race.retirements.map((retirement) => retirement.driverNumber).toSorted(), [
			'18',
			'23',
			'5'
		]);
	});

	it('marks the real VSC laps and lets Antonelli pit cheaply under the first one', () => {
		const statuses = new Set(
			race.laps.filter((lap) => lap.lap === 3).map((lap) => lap.trackStatus)
		);

		assert.deepEqual([...statuses], ['vsc']);
		assert.ok(race.pitStops.some((stop) => stop.driverNumber === '12' && stop.lap === 2));
	});

	it('has plausible green-flag lap times', () => {
		const greenLaps = race.laps.filter(
			(lap) => lap.trackStatus === 'green' && !lap.pitIn && !lap.pitOut && lap.lap > 1
		);

		for (const lap of greenLaps) {
			assert.ok(
				lap.lapTimeMs > 92_000 && lap.lapTimeMs < 100_000,
				`${lap.driverNumber} L${lap.lap}`
			);
		}
	});
});

describe('snapshotAtLap', () => {
	it('only exposes what was known at that lap', () => {
		const snapshot = snapshotAtLap(race, 20);

		assert.equal(snapshot.currentLap, 20);
		assert.ok(snapshot.laps.every((lap) => lap.lap <= 20));
		assert.ok(snapshot.stints.every((stint) => stint.endLap <= 20));
		assert.ok(snapshot.raceControl.every((message) => message.lap <= 20));
	});
});
