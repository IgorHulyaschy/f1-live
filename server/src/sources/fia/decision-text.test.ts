import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { parseDecisionText } from './decision-text.js';

function parse(name: string, summons = false) {
	return parseDecisionText(
		readFileSync(new URL(`fixtures/decisions/${name}.txt`, import.meta.url), 'utf8'),
		summons
	);
}

describe('FIA decision text', () => {
	it('reads a time penalty with penalty points', () => {
		const decision = parse('time-5s-points-2020');

		assert.equal(decision.document, 46);
		assert.equal(decision.car, '23');
		assert.equal(decision.driverName, 'Alexander Albon');
		assert.equal(decision.session, 'race');
		assert.equal(decision.time, '14:15');
		assert.deepEqual(decision.penalties, [
			{ kind: 'time', seconds: 5 },
			{ kind: 'penalty_points', amount: 2 }
		]);
	});

	it('reads a ten second penalty in the 2021 wording', () => {
		assert.deepEqual(parse('time-10s-2021').penalties, [
			{ kind: 'time', seconds: 10 },
			{ kind: 'penalty_points', amount: 2 }
		]);
	});

	it('reads grid drops from 2019 and 2024', () => {
		assert.deepEqual(parse('grid-15-2019').penalties, [{ kind: 'grid', places: 15 }]);
		assert.deepEqual(parse('grid-3-2024').penalties, [
			{ kind: 'grid', places: 3 },
			{ kind: 'penalty_points', amount: 2 }
		]);
	});

	it('reads a reprimand with a fine', () => {
		assert.deepEqual(parse('reprimand-fine-2021').penalties, [
			{ kind: 'reprimand' },
			{ kind: 'fine', amount: 10_000 }
		]);
	});

	it('reads a disqualification', () => {
		const decision = parse('disqualified-2019');

		assert.equal(decision.driverName, 'Pierre Gasly');
		assert.equal(decision.session, 'qualifying');
		assert.deepEqual(decision.penalties, [{ kind: 'disqualification' }]);
	});

	it('reads a fine on the team, which has no car', () => {
		const decision = parse('fine-team-2024');

		assert.equal(decision.car, null);
		assert.equal(decision.team, 'McLaren Formula 1 Team');
		assert.deepEqual(decision.penalties, [{ kind: 'fine', amount: 5000 }]);
	});

	it('reads a pit lane start next to a time penalty', () => {
		assert.deepEqual(parse('pit-lane-2023').penalties, [
			{ kind: 'time', seconds: 10 },
			{ kind: 'other' }
		]);
	});

	it('reads no further action', () => {
		const decision = parse('no-action-2019');

		assert.equal(decision.outcome, 'no_action');
		assert.deepEqual(decision.penalties, []);
	});

	it('reads a summons as an investigation', () => {
		const decision = parse('summons-2022', true);

		assert.equal(decision.outcome, 'investigation');
		assert.equal(decision.car, '55');
		assert.equal(decision.driverName, 'Carlos Sainz');
	});

	it('reads deleted lap times that name many cars', () => {
		const decision = parse('deleted-laps-2025');

		assert.equal(decision.outcome, 'penalty');
		assert.equal(decision.car, null);
	});

	it('marks a document without the labelled block as unreadable', () => {
		const decision = parseDecisionText('', false);

		assert.equal(decision.outcome, 'unreadable');
		assert.deepEqual(decision.penalties, []);
	});
});
