import type { CircuitFacts, DriverFacts } from '@f1-live/shared/facts';
import { z } from 'zod';

const snakSchema = z.object({
	snaktype: z.string(),
	datavalue: z.object({ type: z.string(), value: z.unknown() }).optional()
});

const claimSchema = z.object({
	rank: z.enum(['preferred', 'normal', 'deprecated']),
	mainsnak: snakSchema
});

/** One item as `wbgetentities` returns it, cut to what the facts read. */
export const entitySchema = z.object({
	id: z.string(),
	labels: z.record(z.string(), z.object({ value: z.string() })).default({}),
	claims: z.record(z.string(), z.array(claimSchema)).default({})
});

export type Entity = z.infer<typeof entitySchema>;

const itemValue = z.object({ id: z.string() });

const timeValue = z.object({ time: z.string(), precision: z.number() });

const quantityValue = z.object({ amount: z.string(), unit: z.string() });

const coordinateValue = z.object({ latitude: z.number(), longitude: z.number() });

const METRE = 'http://www.wikidata.org/entity/Q11573';

const KILOMETRE = 'http://www.wikidata.org/entity/Q828224';

/** The day precision of a Wikidata time: a year or a month is not a date we can show. */
const DAY_PRECISION = 11;

const YEAR_PRECISION = 9;

/** The values of a property worth reading: preferred ones if there are any, else the normal ones. */
function values<T extends z.ZodType>(entity: Entity, property: string, schema: T): z.output<T>[] {
	const claims = (entity.claims[property] ?? []).filter((claim) => claim.rank !== 'deprecated');
	const preferred = claims.filter((claim) => claim.rank === 'preferred');

	return (preferred.length > 0 ? preferred : claims).flatMap((claim) => {
		const parsed = schema.safeParse(claim.mainsnak.datavalue?.value);

		return parsed.success ? [parsed.data] : [];
	});
}

/** The ids of the items a property points to, for the labels to be fetched. */
export function linkedItems(entity: Entity, properties: readonly string[]): string[] {
	return properties.flatMap((property) =>
		values(entity, property, itemValue)
			.slice(0, 1)
			.map((value) => value.id)
	);
}

function labelOf(labels: ReadonlyMap<string, string>, entity: Entity, property: string) {
	const id = values(entity, property, itemValue)[0]?.id;

	return (id === undefined ? undefined : labels.get(id)) ?? null;
}

/** "+1985-01-07T00:00:00Z" as "1985-01-07", where Wikidata knows the day. */
function dayOf(entity: Entity, property: string): string | null {
	const known = values(entity, property, timeValue).find(
		(value) => value.precision >= DAY_PRECISION
	);

	return known?.time.match(/^\+?(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
}

function yearOf(entity: Entity, property: string): number | null {
	const known = values(entity, property, timeValue).find(
		(value) => value.precision >= YEAR_PRECISION
	);

	const year = known?.time.match(/^\+?(\d{4})/)?.[1];

	return year === undefined ? null : Number(year);
}

/** The first length in metres: the circuit's grand-prix layout is the one Wikidata lists first. */
function lengthOf(entity: Entity): number | null {
	for (const { amount, unit } of values(entity, 'P2043', quantityValue)) {
		const value = Number(amount);

		if (unit === METRE) {
			return value;
		}

		if (unit === KILOMETRE) {
			return Math.round(value * 1000);
		}
	}

	return null;
}

export const DRIVER_LINKS = ['P19', 'P27'];

export const CIRCUIT_LINKS = ['P131', 'P17'];

export function driverFactsOf(entity: Entity, labels: ReadonlyMap<string, string>): DriverFacts {
	return {
		wikidata: entity.id,
		birthDate: dayOf(entity, 'P569'),
		birthPlace: labelOf(labels, entity, 'P19'),
		nationality: labelOf(labels, entity, 'P27')
	};
}

export function circuitFactsOf(entity: Entity, labels: ReadonlyMap<string, string>): CircuitFacts {
	const point = values(entity, 'P625', coordinateValue)[0];

	return {
		wikidata: entity.id,
		lengthMetres: lengthOf(entity),
		openedYear: yearOf(entity, 'P571'),
		location: labelOf(labels, entity, 'P131'),
		country: labelOf(labels, entity, 'P17'),
		latitude: point?.latitude ?? null,
		longitude: point?.longitude ?? null
	};
}
