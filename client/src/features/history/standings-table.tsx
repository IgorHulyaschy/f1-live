import type { SeasonResults, SessionFilter } from '@f1-live/shared/results';
import { driverStandings, teamStandings } from '@f1-live/shared/results';
import { Link } from 'react-router';

import { CarSide, DriverPortrait, TeamLogo } from '@/components/driver-media';
import { latestEntries, seasonFace, seasonTeam, standingsMoves } from '@/insights/season-results';
import { hasTeamPictures } from '@/lib/media';
import { cn } from '@/lib/utils';

export type StandingsView = 'drivers' | 'teams';

function points(value: number): string {
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function Move({ places }: { places: number | undefined }) {
	if (places === undefined || places === 0) {
		return <span className="text-muted-foreground">–</span>;
	}

	return (
		<span aria-label={places > 0 ? `Up ${places}` : `Down ${-places}`}>
			{places > 0 ? `▲${places}` : `▼${-places}`}
		</span>
	);
}

/**
 * The drivers' or constructors' standings after a round, as a timing tower: place, the change
 * since the round before, wins, podiums and points. Drivers open their pages.
 */
export function StandingsTable({
	season,
	view,
	throughRound,
	include,
	limit,
	className
}: {
	season: SeasonResults;
	view: StandingsView;
	throughRound: number;
	include: SessionFilter;
	/** Rows to show; all by default. */
	limit?: number;
	className?: string;
}) {
	const entrants = latestEntries(season, throughRound);
	const moves = view === 'drivers' ? standingsMoves(season, throughRound, include) : new Map();

	const entries = (
		view === 'drivers'
			? driverStandings(season, throughRound, include)
			: teamStandings(season, throughRound, include)
	).slice(0, limit);

	const leader = entries[0]?.points ?? 0;

	return (
		<table className={cn('w-full text-sm', className)} data-testid={`standings-${view}`}>
			<caption className="sr-only">
				{view === 'drivers' ? 'Drivers' : 'Constructors'} after round {throughRound}
			</caption>
			<thead>
				<tr className="border-b">
					<th scope="col" className="type-label w-10 py-1.5 text-left font-normal">
						Pos
					</th>
					{view === 'drivers' ? (
						<th scope="col" className="type-label w-10 text-right font-normal">
							<span className="sr-only">Change</span>
						</th>
					) : null}
					<th scope="col" className="type-label px-2 text-left font-normal">
						{view === 'drivers' ? 'Driver' : 'Team'}
					</th>
					{view === 'teams' ? (
						<th scope="col" className="type-label hidden px-2 font-normal @lg:table-cell">
							<span className="sr-only">Car</span>
						</th>
					) : null}
					<th scope="col" className="type-label hidden px-2 text-right font-normal @md:table-cell">
						Wins
					</th>
					<th scope="col" className="type-label hidden px-2 text-right font-normal @md:table-cell">
						Podiums
					</th>
					<th scope="col" className="type-label hidden px-2 text-right font-normal @sm:table-cell">
						Gap
					</th>
					<th scope="col" className="type-label pl-2 text-right font-normal">
						Pts
					</th>
				</tr>
			</thead>
			<tbody>
				{entries.map((entry) => {
					const team = view === 'drivers' ? (entrants.get(entry.id)?.team ?? '') : entry.id;
					const driver = season.drivers[entry.id];
					const subject = seasonTeam(season, team);

					return (
						<tr key={entry.id} className="h-9 border-b last:border-b-0" data-testid="standings-row">
							<td className="font-mono font-bold">{entry.position}</td>
							{view === 'drivers' ? (
								<td className="text-right font-mono text-xs">
									<Move places={moves.get(entry.id)} />
								</td>
							) : null}
							<td className="min-w-0 px-2">
								<span className="flex min-w-0 items-center gap-2">
									<span
										aria-hidden
										className="bg-team h-4 w-1 shrink-0"
										style={{ '--team': `#${season.teams[team] ?? '888888'}` }}
									/>
									{view === 'drivers' ? (
										<Link
											to={`/drivers/${entry.id}`}
											className="flex min-w-0 items-center gap-2 hover:underline"
										>
											<DriverPortrait
												driver={seasonFace(season, entry.id, entrants.get(entry.id))}
												size="sm"
											/>
											<span className="type-wide text-xs font-bold">
												{driver?.code ?? entry.id}
											</span>
											<span className="text-muted-foreground hidden truncate text-xs @xl:inline">
												{driver ? `${driver.firstName} ${driver.lastName}` : ''}
											</span>
										</Link>
									) : (
										<>
											{hasTeamPictures(subject) ? (
												<TeamLogo subject={subject} size="sm" showName={false} />
											) : null}
											<span className="type-wide truncate text-xs font-bold">{entry.id}</span>
										</>
									)}
								</span>
							</td>
							{view === 'teams' ? (
								<td className="hidden px-2 @lg:table-cell">
									{hasTeamPictures(subject) ? <CarSide subject={subject} size="sm" /> : null}
								</td>
							) : null}
							<td className="hidden px-2 text-right font-mono @md:table-cell">{entry.wins}</td>
							<td className="hidden px-2 text-right font-mono @md:table-cell">{entry.podiums}</td>
							<td className="text-muted-foreground hidden px-2 text-right font-mono @sm:table-cell">
								{entry.position === 1 ? '–' : `−${points(leader - entry.points)}`}
							</td>
							<td className="pl-2 text-right font-mono font-bold">{points(entry.points)}</td>
						</tr>
					);
				})}
			</tbody>
		</table>
	);
}
