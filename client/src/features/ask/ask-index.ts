import { bestMatch } from '@f1-live/shared/ask-match';

import { labelOf } from './ask-context.ts';
import { type AskData, driverHref, sessionHref, sessionsOf, standingsHref } from './ask-data.ts';

/** The groups of the palette, in the order they show when they score alike. */
export const PALETTE_GROUPS = [
	'Follow',
	'Drivers',
	'Grands Prix',
	'Teams',
	'Seasons',
	'Pages',
	'Sessions',
	'Dashboards',
	'Tiles',
	'Session',
	'Settings'
] as const;

export type PaletteGroup = (typeof PALETTE_GROUPS)[number];

/** One thing the palette can open, with every name a viewer might type for it. */
export type IndexEntry = {
	id: string;
	group: PaletteGroup;
	label: string;
	hint: string | null;
	names: readonly string[];
	href: string;
	/** Whether the open session goes along, as on the dashboards. */
	carry?: boolean;
};

/** The pages a viewer can go to by name. */
const PAGES: readonly Omit<IndexEntry, 'group'>[] = [
	{
		id: 'calendar',
		label: 'Calendar',
		hint: 'Every weekend, in your time',
		names: ['calendar', 'schedule', 'next race', 'countdown', 'when is the race'],
		href: '/calendar'
	},
	{
		id: 'standings',
		label: 'Standings',
		hint: 'Drivers’ championship',
		names: ['standings', 'championship', 'points table', 'drivers championship'],
		href: '/standings'
	},
	{
		id: 'constructors',
		label: 'Constructors standings',
		hint: 'Teams’ championship',
		names: ['constructors standings', 'teams championship', 'constructors'],
		href: '/standings?view=teams'
	},
	{
		id: 'h2h',
		label: 'Head to head',
		hint: 'Any two drivers or teams',
		names: ['head to head', 'h2h', 'versus', 'compare drivers', 'teammates'],
		href: '/h2h'
	},
	{
		id: 'library',
		label: 'Library',
		hint: 'Fan dashboards',
		names: ['library', 'fan dashboards', 'ready made dashboards', 'templates'],
		href: '/library'
	},
	{
		id: 'strategy',
		label: 'Strategy',
		hint: 'Stints, tyres and stops of this session',
		names: ['strategy', 'tyres', 'stints', 'pit stops', 'undercut'],
		href: '/strategy',
		carry: true
	},
	{
		id: 'analysis',
		label: 'Analysis',
		hint: 'Lap times and pace of this session',
		names: ['analysis', 'lap times', 'compare laps', 'pace', 'charts', 'telemetry'],
		href: '/analysis',
		carry: true
	}
];

/**
 * Everything of the history the palette finds by name: every driver and team since 2018, every
 * grand prix (its latest race), every season and the pages.
 */
export function historyIndex(data: AskData): IndexEntry[] {
	const { context } = data;

	const latestRace = new Map(
		sessionsOf(data, 'race')
			.filter((info) => Date.parse(info.startsAt) <= data.now)
			.map((info) => [info.event, info])
	);

	return [
		...context.entities.flatMap((entity): IndexEntry[] => {
			if (entity.kind === 'driver') {
				const season = data.seasons.findLast((candidate) => candidate.drivers[entity.id]);
				const driver = season?.drivers[entity.id];

				return [
					{
						id: `driver-${entity.id}`,
						group: 'Drivers',
						label: driver ? `${driver.firstName} ${driver.lastName}` : entity.label,
						hint: season ? `Driver page, ${season.season}` : 'Driver page',
						names: [...entity.names, ...(entity.codes ?? [])],
						href: driverHref(entity.id)
					}
				];
			}

			if (entity.kind === 'team') {
				return [
					{
						id: `team-${entity.id}`,
						group: 'Teams',
						label: entity.label,
						hint: 'Constructors standings',
						names: entity.names,
						href: standingsHref(context.season, null, true)
					}
				];
			}

			const race = latestRace.get(entity.id);

			return race
				? [
						{
							id: `event-${entity.id}`,
							group: 'Grands Prix',
							label: labelOf(context, 'event', entity.id),
							hint: `${race.season} race`,
							names: entity.names,
							href: sessionHref(race.key)
						}
					]
				: [];
		}),
		...data.seasons.toReversed().map((season): IndexEntry => ({
			id: `season-${season.season}`,
			group: 'Seasons',
			label: `${season.season} season`,
			hint: 'Standings',
			names: [String(season.season), `${season.season} season`],
			href: standingsHref(season.season, null, false)
		})),
		...PAGES.map((page): IndexEntry => ({ ...page, group: 'Pages' }))
	];
}

/** The pages alone, for before the results have loaded. */
export function pageIndex(): IndexEntry[] {
	return PAGES.map((page) => ({ ...page, group: 'Pages' }));
}

/**
 * The entries that match `text`, best first, typos allowed: a word may be a prefix of a name
 * while it is being typed.
 */
export function rank<Entry extends { names: readonly string[] }>(
	entries: readonly Entry[],
	text: string,
	minScore = 0.55
): Entry[] {
	return entries
		.flatMap((entry) => {
			const score = bestMatch(text, entry.names);

			return score >= minScore ? [{ entry, score }] : [];
		})
		.toSorted((a, b) => b.score - a.score)
		.map(({ entry }) => entry);
}

/** Entries that match `text` in their groups, the group with the best match first. */
export function rankGroups<Entry extends { names: readonly string[]; group: PaletteGroup }>(
	entries: readonly Entry[],
	text: string,
	perGroup = 4
): { group: PaletteGroup; entries: Entry[] }[] {
	const groups = new Map<PaletteGroup, { best: number; entries: Entry[] }>();

	for (const entry of entries) {
		const score = bestMatch(text, entry.names);

		if (score < 0.55) {
			continue;
		}

		const group = groups.get(entry.group) ?? { best: 0, entries: [] };

		group.best = Math.max(group.best, score);
		group.entries.push(entry);
		groups.set(entry.group, group);
	}

	return [...groups.entries()]
		.toSorted(
			([groupA, a], [groupB, b]) =>
				b.best - a.best || PALETTE_GROUPS.indexOf(groupA) - PALETTE_GROUPS.indexOf(groupB)
		)
		.map(([group, { entries: found }]) => ({
			group,
			entries: rank(found, text, 0).slice(0, perGroup)
		}));
}
