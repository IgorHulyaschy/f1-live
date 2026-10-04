import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { circuitFactsOf, driverFactsOf, type Entity, entitySchema } from './entity.js';

const items = new Map(
	Object.entries(
		JSON.parse(readFileSync(new URL('fixtures/entities.json', import.meta.url), 'utf8'))
	).map(([id, raw]) => [id, entitySchema.parse(raw)] as const)
);

const labels = new Map(
	[...items.values()].map((entity) => [entity.id, entity.labels['en']?.value ?? ''])
);

function item(id: string): Entity {
	const entity = items.get(id);

	assert.ok(entity, id);

	return entity;
}

describe('Wikidata entity facts', () => {
	it('reads a driver: the preferred birth date, the place and the country', () => {
		assert.deepEqual(driverFactsOf(item('Q10514'), labels), {
			wikidata: 'Q10514',
			birthDate: '1981-07-29',
			birthPlace: 'Oviedo',
			nationality: 'Spain'
		});
	});

	it('skips a birth date that holds only a year when a full one exists', () => {
		assert.equal(driverFactsOf(item('Q9673'), labels).birthDate, '1985-01-07');
	});

	it('reads a circuit: length, opening year, place, country and coordinates', () => {
		assert.deepEqual(circuitFactsOf(item('Q172851'), labels), {
			wikidata: 'Q172851',
			lengthMetres: 7003,
			openedYear: 1924,
			location: 'Province of Liege',
			country: 'Belgium',
			latitude: 50.437222222222,
			longitude: 5.9713888888889
		});
	});

	it('leaves out what Wikidata does not hold', () => {
		const facts = circuitFactsOf(item('Q113112116'), labels);

		assert.equal(facts.lengthMetres, null);
		assert.equal(facts.openedYear, null);
		assert.equal(facts.location, 'Paradise');
	});
});
