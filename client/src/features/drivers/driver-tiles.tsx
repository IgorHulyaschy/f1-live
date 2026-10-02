import { CarSide, DriverPortrait, TeamLogo } from '@/components/driver-media';
import { Digits } from '@/components/console/digits';
import { Field, Panel, PanelHeader } from '@/components/console/panel';
import { TyreBadge } from '@/components/tyre-badge';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select';
import { useRace } from '@/data/race-context';
import type { StandingRow } from '@/insights/standings';
import { formatGap, formatLapTime } from '@/lib/format';
import { cn } from '@/lib/utils';

function gapText(row: StandingRow): string {
	if (row.state === 'out') {
		return 'Out';
	}

	if (row.lapsDown > 0) {
		return `+${row.lapsDown}L`;
	}

	return row.position === 1 || row.gapToLeaderMs === null ? 'Leader' : formatGap(row.gapToLeaderMs);
}

/** The driver you follow, large: picture, car, team and where they run. */
export function DriverCard() {
	const { followedDriver, setFollowedDriver, standings } = useRace();
	const row = standings.find((entry) => entry.driver.number === followedDriver) ?? standings[0];

	if (!row) {
		return null;
	}

	const { driver } = row;

	return (
		<Panel aria-label="Driver" data-testid="driver-card">
			<PanelHeader title="Driver">
				<Select value={driver.number} onValueChange={setFollowedDriver}>
					<SelectTrigger size="sm" aria-label="Driver shown">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{standings.map((entry) => (
							<SelectItem key={entry.driver.number} value={entry.driver.number}>
								{entry.driver.code} {entry.driver.lastName}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</PanelHeader>
			<div className="flex items-stretch border-b">
				<DriverPortrait driver={driver} tinted className="h-36 w-28 @md:h-44 @md:w-36" />
				<div className="flex min-w-0 flex-1 flex-col justify-between gap-3 px-4 py-3">
					<div className="flex min-w-0 flex-col gap-1">
						<span className="type-label">{driver.firstName}</span>
						<span className="type-wide truncate text-2xl leading-none font-black @md:text-3xl">
							{driver.lastName}
						</span>
						<TeamLogo driver={driver} className="mt-1 h-5 w-28" />
					</div>
					<div className="flex items-end gap-4 font-mono">
						<span className="flex flex-col">
							<span className="type-label">Pos</span>
							<span className="text-3xl leading-none font-bold">
								{row.state === 'out' ? '-' : row.position}
							</span>
						</span>
						<span className="flex flex-col">
							<span className="type-label">Gap</span>
							<span className="text-sm">{gapText(row)}</span>
						</span>
					</div>
				</div>
			</div>
			<div className="grid grid-cols-2 border-b @md:grid-cols-4 @md:divide-x">
				<Field label="Last" className="px-4 py-2.5">
					{row.lastLap ? <Digits value={formatLapTime(row.lastLap.lapTimeMs)} /> : '-'}
				</Field>
				<Field label="Best" className="px-4 py-2.5">
					{row.bestLapMs === null ? '-' : <Digits value={formatLapTime(row.bestLapMs)} />}
				</Field>
				<Field label="Tyre" className="px-4 py-2.5">
					{row.compound ? <TyreBadge compound={row.compound} age={row.tyreAge} /> : '-'}
				</Field>
				<Field label="Stops" className="px-4 py-2.5">
					<span className="font-mono">{row.pitStops}</span>
				</Field>
			</div>
			<CarSide driver={driver} className="mx-4 my-3" />
		</Panel>
	);
}

/** Every driver as a picture plate in running order. Pick one to follow them. */
export function GridWall() {
	const { followedDriver, setFollowedDriver, standings } = useRace();

	return (
		<Panel aria-label="Grid" data-testid="grid-wall">
			<PanelHeader title="Grid" meta="Running order" />
			<ol className="grid grid-cols-3 @md:grid-cols-5 @4xl:grid-cols-10">
				{standings.map((row) => {
					const followed = row.driver.number === followedDriver;

					return (
						<li key={row.driver.number} className="border-r border-b">
							<button
								type="button"
								aria-pressed={followed}
								aria-label={`P${row.position} ${row.driver.firstName} ${row.driver.lastName}, ${gapText(row)}`}
								onClick={() => setFollowedDriver(row.driver.number)}
								className={cn(
									'hover:bg-accent focus-visible:bg-accent flex w-full flex-col text-left transition-colors focus-visible:outline-none',
									followed && 'bg-accent',
									row.state === 'out' && 'opacity-50'
								)}
							>
								<DriverPortrait driver={row.driver} tinted={followed} className="h-24 w-full" />
								<span className="flex flex-col gap-1 px-2 py-1.5">
									<span className="flex items-baseline gap-1.5">
										<span className="font-mono text-xs font-bold">{row.position}</span>
										<span className="type-wide text-sm leading-none font-bold">
											{row.driver.code}
										</span>
										{followed ? <span className="bg-focus ml-auto size-1.5" /> : null}
									</span>
									<span className="flex items-center justify-between gap-1">
										<span className="text-muted-foreground font-mono text-xs">{gapText(row)}</span>
										{row.compound ? <TyreBadge compound={row.compound} /> : null}
									</span>
								</span>
							</button>
						</li>
					);
				})}
			</ol>
		</Panel>
	);
}
