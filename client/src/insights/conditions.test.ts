import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	conditionsByLap,
	straights,
	temperatureSensitivity,
	windOnStraights
} from './conditions.ts';
import { fixtureSession, lasVegasOutline } from './test-fixtures.ts';

const outline = lasVegasOutline();

describe('straights', () => {
	const found = straights(outline);

	it('finds Koval Lane, the Strip and Harmon Avenue on the Las Vegas outline', () => {
		// The circuit runs anticlockwise: north up Koval Lane after the start, south down the Strip,
		// east along Harmon Avenue back to the pits
		// (https://en.wikipedia.org/wiki/Las_Vegas_Strip_Circuit).
		assert.deepEqual(
			found.map((straight) => Math.round(straight.bearingDeg / 10) * 10),
			[360, 180, 90]
		);

		const strip = found[1];

		assert.ok(strip && strip.lengthM > 1200, `${strip?.lengthM}`);
	});
});

describe('windOnStraights', () => {
	const found = straights(outline);

	it('turns wind from the south into a headwind down the Strip and a tailwind up Koval Lane', () => {
		const [koval, strip, harmon] = windOnStraights(found, {
			windSpeedMs: 2,
			windDirectionDeg: 180
		});

		assert.ok(strip && strip.headwindMs > 1.9);
		assert.ok(koval && koval.headwindMs < -1.9);
		// Harmon runs east: wind from the south comes from the right.
		assert.ok(harmon && Math.abs(harmon.headwindMs) < 0.1 && harmon.crosswindMs < -1.9);
	});

	it('has nothing without a wind direction', () => {
		assert.deepEqual(windOnStraights(found, { windSpeedMs: 2 }), []);
	});
});

describe('track temperature against pace', () => {
	const race = fixtureSession('9858');
	const rows = conditionsByLap(race);

	it('pairs each lap’s temperatures with the field’s pace, without the neutralised opening laps', () => {
		assert.equal(rows.length, 50);
		assert.equal(rows[0]?.paceS, null);
		assert.ok(rows.slice(4).every((row) => row.paceS !== null));
	});

	it('sees the track cool by about 1.5 °C while the pace improved', () => {
		const first = rows[0]?.trackTempC ?? 0;
		const last = rows.at(-1)?.trackTempC ?? 0;
		const link = temperatureSensitivity(rows);

		assert.ok(first - last > 1 && first - last < 2, `${first} to ${last}`);
		assert.ok(link && link.secondsPerDegree > 0 && link.correlation > 0.5);
		assert.equal(temperatureSensitivity(rows.slice(0, 5)), null);
	});
});
