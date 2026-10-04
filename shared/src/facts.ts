import { z } from 'zod';

/**
 * Facts about drivers and circuits from Wikidata (CC0), written by `npm run facts -w server` to
 * `out/facts.json`. The ids are ours (`driverIdOf`, `circuitIdOf`); the mapping to Wikidata is a
 * reviewed file in the server.
 */

export const driverFactsSchema = z.object({
	wikidata: z.string(),
	/** "1985-01-07". Wikidata may hold only a year or a month: those are left out. */
	birthDate: z.string().nullable(),
	birthPlace: z.string().nullable(),
	/** The country the driver races for, as Wikidata names it ("United Kingdom"). */
	nationality: z.string().nullable()
});

export type DriverFacts = z.infer<typeof driverFactsSchema>;

export const circuitFactsSchema = z.object({
	wikidata: z.string(),
	/** In metres. */
	lengthMetres: z.number().nullable(),
	/** The year the circuit opened. */
	openedYear: z.int().nullable(),
	/** The place and the country, as Wikidata names them. */
	location: z.string().nullable(),
	country: z.string().nullable(),
	latitude: z.number().nullable(),
	longitude: z.number().nullable()
});

export type CircuitFacts = z.infer<typeof circuitFactsSchema>;

export const factsSchema = z.object({
	/** ISO 8601 date the facts were fetched. */
	fetchedAt: z.string(),
	drivers: z.record(z.string(), driverFactsSchema),
	circuits: z.record(z.string(), circuitFactsSchema)
});

export type Facts = z.infer<typeof factsSchema>;

/** A circuit's id from the name the results index carries: "Yas Marina Circuit" is "yas-marina-circuit". */
export function circuitIdOf(circuit: string): string {
	return circuit
		.normalize('NFD')
		.replaceAll(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, '-')
		.replaceAll(/^-|-$/g, '');
}

/** Whole years between an ISO date ("1985-01-07") and a day, counting the birthday. */
export function ageOn(birthDate: string, on: Date): number {
	const [year = 0, month = 0, day = 0] = birthDate.split('-').map(Number);

	const birthday =
		on.getUTCMonth() + 1 > month || (on.getUTCMonth() + 1 === month && on.getUTCDate() >= day);

	return on.getUTCFullYear() - year - (birthday ? 0 : 1);
}
