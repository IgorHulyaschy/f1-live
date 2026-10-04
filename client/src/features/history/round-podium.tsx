import type { ResultRound, SeasonResults, SessionFilter } from '@f1-live/shared/results';
import { Link } from 'react-router';

import { Panel, PanelHeader } from '@/components/console/panel';
import { DriverPortrait } from '@/components/driver-media';
import { seasonFace } from '@/insights/season-results';

/** The race's first three, as portraits in finishing order. Empty while the race is held back. */
export function RoundPodium({
	season,
	round,
	include,
	className
}: {
	season: SeasonResults;
	round: ResultRound;
	include: SessionFilter;
	className?: string;
}) {
	const race = round.sessions.find((session) => session.type === 'race' && include(session.key));
	const top = race?.rows.filter((row) => row.position <= 3 && row.classified) ?? [];

	if (top.length === 0) {
		return null;
	}

	return (
		<Panel className={className}>
			<PanelHeader title="Podium" meta={`R${round.round}: ${round.name}`} />
			<ol className="grid grid-cols-3 gap-3 px-4 py-3" data-testid="round-podium">
				{top.map((row) => {
					const info = season.drivers[row.driver];

					return (
						<li key={row.driver} className="flex min-w-0 flex-col gap-2">
							<DriverPortrait
								driver={seasonFace(season, row.driver, row)}
								size="lg"
								tinted={row.position === 1}
							/>
							<span className="flex min-w-0 flex-col">
								<span className="type-label">P{row.position}</span>
								<Link to={`/drivers/${row.driver}`} className="min-w-0 hover:underline">
									<span className="type-wide line-clamp-2 text-xs font-bold sm:text-sm">
										{info ? `${info.firstName} ${info.lastName}` : row.driver}
									</span>
								</Link>
								<span className="text-muted-foreground truncate text-xs">{row.team}</span>
							</span>
						</li>
					);
				})}
			</ol>
		</Panel>
	);
}
