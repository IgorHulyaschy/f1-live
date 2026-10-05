import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createResolver, type AskContext } from './ask.ts';

/** Every driver code of the 2018 to 2026 grids, with the id the results index gives. */
const GRID = [
	'VAN:stoffel-vandoorne',
	'RIC:daniel-ricciardo',
	'VET:sebastian-vettel',
	'RAI:kimi-raikkonen',
	'GRO:romain-grosjean',
	'ERI:marcus-ericsson',
	'GAS:pierre-gasly',
	'PER:sergio-perez',
	'ALO:fernando-alonso',
	'LEC:charles-leclerc',
	'STR:lance-stroll',
	'MAG:kevin-magnussen',
	'HUL:nico-hulkenberg',
	'HAR:brendon-hartley',
	'OCO:esteban-ocon',
	'VER:max-verstappen',
	'SIR:sergey-sirotkin',
	'HAM:lewis-hamilton',
	'SAI:carlos-sainz',
	'BOT:valtteri-bottas',
	'NOR:lando-norris',
	'ALB:alexander-albon',
	'KVY:daniil-kvyat',
	'RUS:george-russell',
	'KUB:robert-kubica',
	'GIO:antonio-giovinazzi',
	'LAT:nicholas-latifi',
	'FIT:pietro-fittipaldi',
	'AIT:jack-aitken',
	'MAZ:nikita-mazepin',
	'TSU:yuki-tsunoda',
	'MSC:mick-schumacher',
	'SAR:logan-sargeant',
	'DEV:nyck-de-vries',
	'ZHO:guanyu-zhou',
	'PIA:oscar-piastri',
	'LAW:liam-lawson',
	'BEA:oliver-bearman',
	'COL:franco-colapinto',
	'DOO:jack-doohan',
	'BOR:gabriel-bortoleto',
	'HAD:isack-hadjar',
	'ANT:kimi-antonelli',
	'LIN:arvid-lindblad'
].map((entry) => {
	const [code = '', id = ''] = entry.split(':');

	return { code, id };
});

const CONTEXT: AskContext = {
	season: 2026,
	entities: GRID.map(({ code, id }) => ({
		kind: 'driver',
		id,
		label: id.split('-').at(-1) ?? id,
		names: [id.replaceAll('-', ' '), id.split('-').at(-1) ?? id],
		codes: [code]
	}))
};

const resolve = createResolver(CONTEXT);

const VER = 'max-verstappen';

describe('a three-letter code names its driver, whatever English word it spells', () => {
	for (const { code, id } of GRID.filter(({ id: other }) => other !== VER)) {
		for (const spelling of [code, code.toLowerCase()]) {
			it(`"ver or ${spelling}" compares ${VER} with ${id}`, () => {
				const query = resolve(`who was faster in the second stint, ver or ${spelling}`);

				assert.deepEqual(query, {
					kind: 'pace',
					mode: 'versus',
					session: { kind: 'open' },
					a: { kind: 'driver', id: VER },
					b: { kind: 'driver', id: id },
					span: { kind: 'stint', stint: 2 },
					compound: null
				});
			});

			it(`"${spelling} vs ver" puts ${id} first`, () => {
				const query = resolve(`${spelling} vs ver pace`);

				assert.ok(query && query.kind === 'pace');
				assert.deepEqual(
					[query.a, query.b],
					[
						{ kind: 'driver', id },
						{ kind: 'driver', id: VER }
					]
				);
			});
		}
	}
});

describe('a stint is named by an ordinal word or number', () => {
	for (const [text, stint] of [
		['second stint', 2],
		['2nd stint', 2],
		['stint 3', 3],
		['3rd stint', 3],
		['1st stint', 1]
	] as const) {
		it(`"${text}" is stint ${stint}`, () => {
			const query = resolve(`who was faster in the ${text}, VER or NOR`);

			assert.ok(query && query.kind === 'pace');
			assert.deepEqual(query.span, { kind: 'stint', stint });
		});
	}
});
