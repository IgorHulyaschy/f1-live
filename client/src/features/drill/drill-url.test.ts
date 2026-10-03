import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { type DrillView, readDrill, writeDrill } from './drill-url.ts';

function read(search: string): DrillView | null {
	return readDrill(new URLSearchParams(search));
}

describe('readDrill', () => {
	it('reads the driver, lap and compare views', () => {
		assert.deepEqual(read('session=11373&car=63'), { kind: 'driver', driverNumber: '63' });
		assert.deepEqual(read('car=63&vs=1'), { kind: 'compare', driverNumber: '63', vs: '1' });
		assert.deepEqual(read('car=63&carLap=12'), {
			kind: 'lap',
			driverNumber: '63',
			lap: 12,
			vs: null
		});
		assert.deepEqual(read('car=63&carLap=12&vs=1&vsLap=10'), {
			kind: 'lap',
			driverNumber: '63',
			lap: 12,
			vs: { driverNumber: '1', lap: 10 }
		});
	});

	it('opens nothing for a malformed address', () => {
		assert.equal(read(''), null);
		assert.equal(read('car=VER'), null);
		assert.equal(read('carLap=12'), null);
	});

	it('drops what does not parse and keeps the rest', () => {
		assert.deepEqual(read('car=63&carLap=x'), { kind: 'driver', driverNumber: '63' });
		assert.deepEqual(read('car=63&vs=63'), { kind: 'driver', driverNumber: '63' });
	});
});

describe('writeDrill', () => {
	it('round-trips every view and keeps the race state', () => {
		const views: DrillView[] = [
			{ kind: 'driver', driverNumber: '4' },
			{ kind: 'compare', driverNumber: '4', vs: '81' },
			{ kind: 'lap', driverNumber: '4', lap: 3, vs: null },
			{ kind: 'lap', driverNumber: '4', lap: 3, vs: { driverNumber: '81', lap: null } }
		];

		for (const view of views) {
			const params = writeDrill(new URLSearchParams('session=9858&lap=20'), view);

			assert.deepEqual(readDrill(params), view);
			assert.equal(params.get('session'), '9858');
			assert.equal(params.get('lap'), '20');
		}
	});

	it('closes a view and leaves no drill parameter behind', () => {
		const params = writeDrill(new URLSearchParams('lap=5&car=4&carLap=3&vs=81&vsLap=2'), null);

		assert.equal(params.toString(), 'lap=5');
	});
});
