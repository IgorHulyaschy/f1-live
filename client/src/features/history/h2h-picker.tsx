import type { SeasonResults } from '@f1-live/shared/results';
import { ChevronDownIcon } from 'lucide-react';
import * as React from 'react';

import { Key } from '@/components/console/keys';
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList
} from '@/components/ui/command';
import { allDrivers, teammates } from '@/insights/season-results';
import { teamIdOf, teamLineName } from '@/insights/teams';

import { driverName } from './history-data';

export type H2HMode = 'drivers' | 'teams';

/** One choice in a side's picker: a driver or a team line, with how to show and find it. */
export type Contender = {
	id: string;
	label: string;
	/** Three letters. */
	short: string;
	/** Hex without "#". */
	colour: string;
	/** The latest season they appear in. */
	lastSeason: number;
};

/** Everyone who can be compared in a mode, the most recent first. */
export function contenders(seasons: readonly SeasonResults[], mode: H2HMode): Contender[] {
	const found = new Map<string, Contender>();

	for (const season of seasons) {
		for (const round of season.rounds) {
			for (const session of round.sessions) {
				for (const row of session.rows) {
					const id = mode === 'drivers' ? row.driver : teamIdOf(row.team);
					const colour = season.teams[row.team] ?? '888888';

					if (mode === 'drivers') {
						const info = season.drivers[row.driver];

						found.set(id, {
							id,
							label: driverName(info ?? null, id),
							short: info?.code ?? id.slice(0, 3).toUpperCase(),
							colour,
							lastSeason: season.season
						});
					} else {
						found.set(id, {
							id,
							label: teamLineName(id, row.team),
							short: teamLineName(id, row.team).slice(0, 3).toUpperCase(),
							colour,
							lastSeason: season.season
						});
					}
				}
			}
		}
	}

	const sessions = allDrivers(seasons);

	return [...found.values()].toSorted(
		(a, b) =>
			b.lastSeason - a.lastSeason ||
			(sessions.get(b.id) ?? 0) - (sessions.get(a.id) ?? 0) ||
			a.label.localeCompare(b.label)
	);
}

/**
 * A side of the comparison: a key showing who is picked, opening a search over every driver (or
 * team) in the archive, with the other side's teammates suggested first.
 */
export function ContenderPicker({
	label,
	seasons,
	list: all,
	mode,
	value,
	other,
	onChange
}: {
	label: string;
	seasons: readonly SeasonResults[];
	/** From `contenders`. */
	list: readonly Contender[];
	mode: H2HMode;
	value: Contender | null;
	/** The driver on the other side, whose teammates are suggested. */
	other: string | null;
	onChange: (id: string) => void;
}) {
	const [open, setOpen] = React.useState(false);

	const suggested =
		mode === 'drivers' && other !== null
			? teammates(seasons, other)
					.slice(0, 6)
					.flatMap((mate) => all.filter((entry) => entry.id === mate.driver))
			: [];

	const latest = all[0]?.lastSeason;

	const pick = (id: string) => {
		onChange(id);
		setOpen(false);
	};

	const item = (entry: Contender, group: string) => (
		<CommandItem
			key={`${group}-${entry.id}`}
			value={`${group} ${entry.label} ${entry.short} ${entry.id}`}
			onSelect={() => pick(entry.id)}
		>
			<span
				aria-hidden
				className="bg-team h-4 w-1 shrink-0"
				style={{ '--team': `#${entry.colour}` }}
			/>
			<span className="type-wide w-10 text-xs font-bold">
				{mode === 'drivers' ? entry.short : ''}
			</span>
			<span className="flex-1 truncate">{entry.label}</span>
			<span className="type-label">{entry.lastSeason}</span>
		</CommandItem>
	);

	return (
		<>
			<Key
				onClick={() => setOpen(true)}
				aria-label={`${label}: ${value?.label ?? 'nobody'}`}
				className="h-12 min-w-0 flex-1 justify-between gap-2"
				data-testid={`h2h-pick-${label === 'First' ? 'a' : 'b'}`}
			>
				<span className="flex min-w-0 items-center gap-2">
					{value ? (
						<span
							aria-hidden
							className="bg-team h-5 w-1 shrink-0"
							style={{ '--team': `#${value.colour}` }}
						/>
					) : null}
					<span className="type-wide text-foreground truncate text-sm font-black normal-case italic">
						{value?.label ?? `Pick a ${mode === 'drivers' ? 'driver' : 'team'}`}
					</span>
				</span>
				<ChevronDownIcon aria-hidden />
			</Key>
			<CommandDialog
				open={open}
				onOpenChange={setOpen}
				title={`${label} ${mode === 'drivers' ? 'driver' : 'team'}`}
				description="Search every season in the archive."
			>
				<CommandInput placeholder={mode === 'drivers' ? 'Driver name or code…' : 'Team…'} />
				<CommandList>
					<CommandEmpty>Nobody by that name since 2018.</CommandEmpty>
					{suggested.length > 0 ? (
						<CommandGroup heading="Teammates">
							{suggested.map((entry) => item(entry, 'mate'))}
						</CommandGroup>
					) : null}
					<CommandGroup heading={latest === undefined ? 'All' : `${latest} grid`}>
						{all.filter((entry) => entry.lastSeason === latest).map((entry) => item(entry, 'now'))}
					</CommandGroup>
					<CommandGroup heading="Earlier">
						{all.filter((entry) => entry.lastSeason !== latest).map((entry) => item(entry, 'past'))}
					</CommandGroup>
				</CommandList>
			</CommandDialog>
		</>
	);
}

/** The pair to open with: the followed driver and their teammate, else the latest winner's team. */
export function defaultPair(
	seasons: readonly SeasonResults[],
	followedNumber: string | null
): [string, string] | null {
	const season = seasons.at(-1);

	const race = season?.rounds
		.flatMap((round) => round.sessions)
		.findLast((session) => session.type === 'race' || session.type === 'qualifying');

	if (!race) {
		return null;
	}

	const lead = race.rows.find((row) => row.number === followedNumber) ?? race.rows[0];
	const mate = race.rows.find((row) => row.team === lead?.team && row.driver !== lead.driver);

	return lead && mate ? [lead.driver, mate.driver] : null;
}

/** A side's entry in the list, or a bare one for a driver the loaded seasons do not hold. */
export function contenderOf(list: readonly Contender[], id: string | null): Contender | null {
	if (id === null) {
		return null;
	}

	return (
		list.find((entry) => entry.id === id) ?? {
			id,
			label: id,
			short: id.slice(0, 3).toUpperCase(),
			colour: '888888',
			lastSeason: 0
		}
	);
}
