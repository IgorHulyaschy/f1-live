import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { driverStandings, teamStandings } from '@f1-live/shared/results';

import { fixtureSeasons } from './history-fixture.ts';
import {
	driverWeekends,
	latestTeams,
	scoredRounds,
	seasonSummaries,
	standingsMoves,
	teammates
} from './season-results.ts';

const SEASONS = fixtureSeasons();

const season2021 = SEASONS.find((season) => season.season === 2021);

describe('standings after a round', () => {
	it('has 2021 tied on points before Abu Dhabi, Verstappen ahead on wins', () => {
		assert.ok(season2021);

		const [first, second] = driverStandings(season2021, 21);

		assert.deepEqual(
			[first?.id, first?.points, second?.id, second?.points],
			['max-verstappen', 369.5, 'lewis-hamilton', 369.5]
		);
		assert.ok((first?.wins ?? 0) > (second?.wins ?? 0));
	});

	it('moves drivers between rounds and names their team at the time', () => {
		assert.ok(season2021);
		assert.equal(standingsMoves(season2021, 22).get('max-verstappen'), 0);
		assert.equal(latestTeams(season2021).get('max-verstappen'), 'Red Bull Racing');
		assert.equal(scoredRounds(season2021).length, 22);
		assert.equal(teamStandings(season2021)[0]?.id, 'Mercedes');
	});
});

describe('driver pages', () => {
	it('sums a career season by season', () => {
		const verstappen = seasonSummaries(SEASONS, 'max-verstappen').find(
			(entry) => entry.season === 2023
		);

		assert.deepEqual(
			[verstappen?.wins, verstappen?.points, verstappen?.position, verstappen?.teams],
			[19, 575, 1, ['Red Bull Racing']]
		);
		assert.ok(driverWeekends(SEASONS, 'max-verstappen').length > 150);
	});

	it('lists teammates, latest first', () => {
		const leclerc = teammates(SEASONS, 'charles-leclerc').map((mate) => mate.driver);

		assert.ok(leclerc.indexOf('lewis-hamilton') < leclerc.indexOf('carlos-sainz'));
		assert.ok(leclerc.includes('sebastian-vettel'));
	});
});
