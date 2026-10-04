/**
 * Our ids to Wikidata items, checked by hand against each item's label and birth date or
 * location. A driver id is `driverIdOf`, a circuit id is `circuitIdOf` of the results index's
 * circuit name; a test fails when the index holds one this file lacks.
 */

import { circuitIdOf } from '@f1-live/shared/facts';
import type { SeasonResults } from '@f1-live/shared/results';

export const DRIVER_ITEMS = new Map<string, string>([
	['stoffel-vandoorne', 'Q1344577'],
	['daniel-ricciardo', 'Q82816'],
	['sebastian-vettel', 'Q42311'],
	['kimi-raikkonen', 'Q11192'],
	['romain-grosjean', 'Q82742'],
	['marcus-ericsson', 'Q975207'],
	['pierre-gasly', 'Q11816647'],
	['sergio-perez', 'Q82805'],
	['fernando-alonso', 'Q10514'],
	['charles-leclerc', 'Q17541912'],
	['lance-stroll', 'Q16238921'],
	['kevin-magnussen', 'Q1740212'],
	['nico-hulkenberg', 'Q76547'],
	['brendon-hartley', 'Q361113'],
	['esteban-ocon', 'Q15074165'],
	['max-verstappen', 'Q2239218'],
	['sergey-sirotkin', 'Q544206'],
	['lewis-hamilton', 'Q9673'],
	['carlos-sainz', 'Q544856'],
	['valtteri-bottas', 'Q138745'],
	['lando-norris', 'Q22007193'],
	['alexander-albon', 'Q16149172'],
	['daniil-kvyat', 'Q979668'],
	['george-russell', 'Q17319645'],
	['robert-kubica', 'Q160359'],
	['antonio-giovinazzi', 'Q7084843'],
	['nicholas-latifi', 'Q8898994'],
	['pietro-fittipaldi', 'Q10349696'],
	['jack-aitken', 'Q15292751'],
	['nikita-mazepin', 'Q22008968'],
	['yuki-tsunoda', 'Q59209579'],
	['mick-schumacher', 'Q18119599'],
	['logan-sargeant', 'Q28037494'],
	['nyck-de-vries', 'Q771382'],
	['guanyu-zhou', 'Q17327107'],
	['oscar-piastri', 'Q28741262'],
	['liam-lawson', 'Q59180330'],
	['oliver-bearman', 'Q107023292'],
	['franco-colapinto', 'Q88463514'],
	['jack-doohan', 'Q81453998'],
	['gabriel-bortoleto', 'Q106641273'],
	['isack-hadjar', 'Q105071364'],
	['kimi-antonelli', 'Q112073790'],
	['arvid-lindblad', 'Q117035650']
]);

/** Both outer and grand-prix layouts of a venue point at the venue's item. */
export const CIRCUIT_ITEMS = new Map<string, string>([
	['melbourne', 'Q171288'],
	['sakhir', 'Q171332'],
	['sakhir-outer-track', 'Q171332'],
	['shanghai', 'Q171358'],
	['baku', 'Q17004958'],
	['catalunya', 'Q171404'],
	['monte-carlo', 'Q171400'],
	['montreal', 'Q172860'],
	['paul-ricard', 'Q171424'],
	['spielberg', 'Q171566'],
	['silverstone', 'Q171402'],
	['hockenheim', 'Q152408'],
	['hungaroring', 'Q171356'],
	['spa-francorchamps', 'Q172851'],
	['monza', 'Q171417'],
	['singapore', 'Q171390'],
	['sochi', 'Q174004'],
	['suzuka', 'Q174170'],
	['austin', 'Q59626'],
	['mexico-city', 'Q173099'],
	['interlagos', 'Q171387'],
	['yas-marina-circuit', 'Q172869'],
	['mugello', 'Q782455'],
	['nurburgring', 'Q152207'],
	['algarve-international-circuit', 'Q789427'],
	['imola', 'Q171313'],
	['istanbul', 'Q172743'],
	['zandvoort', 'Q173083'],
	['losail', 'Q547535'],
	['lusail', 'Q547535'],
	['jeddah', 'Q102141307'],
	['miami', 'Q106544792'],
	['las-vegas', 'Q113112116'],
	['madring', 'Q126193406'],
	['kuala-lumpur', 'Q172738']
]);

export interface UnmappedIds {
	drivers: string[];
	circuits: string[];
}

/** The drivers and circuits of these seasons that have no Wikidata item in the mapping. */
export function unmappedIds(seasons: readonly SeasonResults[]): UnmappedIds {
	const drivers = new Set<string>();
	const circuits = new Set<string>();

	for (const season of seasons) {
		for (const id of Object.keys(season.drivers)) {
			if (!DRIVER_ITEMS.has(id)) {
				drivers.add(id);
			}
		}

		for (const round of season.rounds) {
			const id = circuitIdOf(round.circuit);

			if (!CIRCUIT_ITEMS.has(id)) {
				circuits.add(id);
			}
		}
	}

	return { drivers: [...drivers], circuits: [...circuits] };
}
