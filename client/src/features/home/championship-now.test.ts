import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fixtureSession } from '../../insights/test-fixtures.ts';
import { championshipNow } from './championship-now.ts';

const race = fixtureSession('9858');

function top(rows: readonly { id: string; points: number }[]): string[] {
	return rows.slice(0, 3).map((row) => `${row.id} ${row.points}`);
}

describe('championshipNow', () => {
	it('shows the table going into a race whose results are hidden', () => {
		const table = championshipNow(race, { hidden: true, live: false });

		assert.equal(table?.basis, 'before');
		assert.deepEqual(top(table?.drivers ?? []), ['4 390', '81 366', '1 341']);
		assert.equal(table?.teams[0]?.id, 'McLaren');
	});

	it('counts the race, disqualifications included, once it is revealed', () => {
		const table = championshipNow(race, { hidden: false, live: false });

		assert.equal(table?.basis, 'after');
		assert.deepEqual(
			table?.drivers.slice(0, 3).map((row) => row.points),
			[390, 366, 366]
		);
	});

	it('marks a running race as live', () => {
		assert.equal(championshipNow(race, { hidden: false, live: true })?.basis, 'live');
	});

	it('keeps qualifying on the table before the weekend’s race', () => {
		const qualifying = { ...race, session: { ...race.session, type: 'qualifying' as const } };
		const table = championshipNow(qualifying, { hidden: false, live: false });

		assert.equal(table?.basis, 'before');
		assert.deepEqual(top(table?.drivers ?? []), ['4 390', '81 366', '1 341']);
	});

	it('has nothing to show without a championship', () => {
		assert.equal(
			championshipNow({ ...race, championship: undefined }, { hidden: false, live: false }),
			null
		);
	});
});
