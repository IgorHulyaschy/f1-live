import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EMPTY_SNAPSHOT } from '@f1-live/shared';
import type { Lap, RaceSnapshot } from '@f1-live/shared';

import { drawableLap } from './build.js';
import { driveLaps } from './test-circuit.js';
import type { PositionTrack } from './series.js';

/** The feed's publishing delay the outline is drawn with. */
const LATENCY_MS = 300;

const driven = driveLaps([{ lapSeconds: 80, swing: 0.1 }], 0, 0.4, 3);

const [startAt = 0, endAt = 0] = driven.crossings;

/** A car whose position stopped updating, as in the Mexico 2025 first practice. */
const frozen: PositionTrack = {
	at: Float64Array.from(driven.track.at),
	x: new Float64Array(driven.track.at.length).fill(270.1),
	y: new Float64Array(driven.track.at.length).fill(59.1),
	offTrack: new Uint8Array(driven.track.at.length)
};

function lapOf(driverNumber: string, lapTimeMs: number): Lap {
	return {
		driverNumber,
		lap: 5,
		lapTimeMs,
		sectorTimesMs: [lapTimeMs / 3, lapTimeMs / 3, lapTimeMs / 3],
		position: 1,
		gapToLeaderMs: 0,
		intervalMs: 0,
		compound: 'SOFT',
		tyreAge: 5,
		pitIn: false,
		pitOut: false,
		trackStatus: 'green',
		completedAt: new Date(endAt + LATENCY_MS).toISOString()
	};
}

describe('drawableLap', () => {
	const lapTimeMs = endAt - startAt;

	const practice: RaceSnapshot = {
		...EMPTY_SNAPSHOT,
		session: { ...EMPTY_SNAPSHOT.session, type: 'practice' }
	};

	it('draws from the next clean lap when the quickest one has frozen positions', () => {
		const snapshot = {
			...practice,
			laps: [lapOf('1', lapTimeMs - 2000), lapOf('2', lapTimeMs)]
		};

		const drawable = drawableLap(
			snapshot,
			new Map([
				['1', frozen],
				['2', driven.track]
			])
		);

		assert.equal(drawable?.lap.driverNumber, '2');
		assert.ok((drawable?.loop.lengthM ?? 0) > 2000);
	});

	it('finds nothing to draw when every car is frozen', () => {
		const snapshot = { ...practice, laps: [lapOf('1', lapTimeMs), lapOf('2', lapTimeMs)] };

		assert.equal(
			drawableLap(
				snapshot,
				new Map([
					['1', frozen],
					['2', frozen]
				])
			),
			null
		);
	});
});
