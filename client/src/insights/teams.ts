/**
 * Teams across their names: an entry keeps its line when it is renamed or sold, as Toro Rosso
 * became AlphaTauri, RB and Racing Bulls. A name not listed is its own team.
 */
const LINES = [
	{ id: 'mercedes', name: 'Mercedes', names: ['Mercedes'] },
	{ id: 'ferrari', name: 'Ferrari', names: ['Ferrari'] },
	{ id: 'red-bull', name: 'Red Bull Racing', names: ['Red Bull Racing', 'Red Bull'] },
	{ id: 'mclaren', name: 'McLaren', names: ['McLaren'] },
	{ id: 'alpine', name: 'Alpine', names: ['Renault', 'Alpine', 'Alpine F1 Team', 'BWT Alpine'] },
	{
		id: 'aston-martin',
		name: 'Aston Martin',
		names: ['Force India', 'Racing Point Force India', 'Racing Point', 'Aston Martin']
	},
	{
		id: 'sauber',
		name: 'Sauber',
		names: ['Sauber', 'Alfa Romeo Racing', 'Alfa Romeo', 'Kick Sauber', 'Stake F1 Team', 'Audi']
	},
	{
		id: 'racing-bulls',
		name: 'Racing Bulls',
		names: [
			'Toro Rosso',
			'Scuderia Toro Rosso',
			'AlphaTauri',
			'RB',
			'Visa Cash App RB',
			'Racing Bulls'
		]
	},
	{ id: 'haas', name: 'Haas', names: ['Haas F1 Team', 'Haas'] },
	{ id: 'williams', name: 'Williams', names: ['Williams'] },
	{ id: 'cadillac', name: 'Cadillac', names: ['Cadillac'] }
] as const;

const LINE_BY_NAME = new Map<string, (typeof LINES)[number]>(
	LINES.flatMap((line) => line.names.map((name) => [name, line] as const))
);

function slug(name: string): string {
	return name
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, '-')
		.replaceAll(/^-|-$/g, '');
}

/** The team's id across its names, e.g. "racing-bulls" for "AlphaTauri". */
export function teamIdOf(name: string): string {
	return LINE_BY_NAME.get(name)?.id ?? slug(name);
}

/** How a team is named across seasons: its current name. */
export function teamLineName(id: string, fallback: string): string {
	return LINES.find((line) => line.id === id)?.name ?? fallback;
}
