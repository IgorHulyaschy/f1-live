import { Digits } from '@/components/console/digits';
import { EmptyNote } from '@/components/console/empty-note';
import { Field, Panel, PanelHeader } from '@/components/console/panel';
import { ProGate } from '@/components/pro-gate';
import { RaceOnly } from '@/components/race-only';
import { TyreBadge } from '@/components/tyre-badge';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select';
import { useRace } from '@/data/race-context';
import { DriverLink } from '@/features/drill/drill-parts';
import { isTimedSession } from '@/insights/qualifying';
import { OUT_LABEL } from '@/insights/standings';
import { formatLapTime, plural } from '@/lib/format';
import { cn } from '@/lib/utils';

import { BoxNow } from './box-now';
import { GapLadder } from './gap-ladder';

export function FocusPanel() {
	const { race, followedDriver, setFollowedDriver, standings } = useRace();
	const rows = standings;
	const timed = isTimedSession(race.session.type);
	const row = rows.find((entry) => entry.driver.number === followedDriver) ?? rows[0];

	if (!row) {
		return (
			<Panel data-focus-panel aria-label="Followed driver" data-testid="followed-driver">
				<PanelHeader title="Focus" />
				<EmptyNote />
			</Panel>
		);
	}

	const gained = row.positionsGained ?? 0;

	return (
		<Panel
			data-focus-panel
			aria-label="Followed driver"
			data-testid="followed-driver"
			className="scroll-mt-16"
		>
			<PanelHeader title="Focus">
				<Select value={row.driver.number} onValueChange={setFollowedDriver}>
					<SelectTrigger size="sm" aria-label="Followed driver">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{rows.map((entry) => (
							<SelectItem key={entry.driver.number} value={entry.driver.number}>
								{entry.driver.code} {entry.driver.lastName}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</PanelHeader>
			<div
				className="flex items-stretch border-b"
				style={{ '--team': `#${row.driver.teamColour}` }}
			>
				<span className="bg-team text-background cut-corner type-wide flex min-w-28 items-center justify-center px-4 text-5xl font-black italic">
					{row.out ? OUT_LABEL[row.out] : `P${row.position}`}
				</span>
				<div className="flex min-w-0 flex-col justify-center gap-2 px-4 py-3">
					<DriverLink driver={row.driver} className="self-start">
						<span className="type-wide truncate text-lg leading-none font-black">
							{row.driver.lastName}
						</span>
					</DriverLink>
					<span className="type-label truncate">
						#{row.driver.number} {row.driver.team}
					</span>
					<span className="type-label">
						{timed ? plural(row.lapsCompleted, 'lap') : `Grid P${row.gridPosition ?? '-'}`}
						{gained === 0 || timed ? null : (
							<span className={cn('ml-2', gained > 0 ? 'text-personal-best' : 'text-danger')}>
								{gained > 0 ? `+${gained}` : gained}
							</span>
						)}
					</span>
				</div>
			</div>
			<div className="grid grid-cols-2 border-b @md:grid-cols-4 @md:divide-x">
				<Field label="Last" className="px-4 py-2.5">
					{row.lastLap ? <Digits value={formatLapTime(row.lastLap.lapTimeMs)} /> : '-'}
				</Field>
				<Field label="Best" className="px-4 py-2.5">
					{row.bestLapMs === null ? (
						'-'
					) : (
						<Digits
							value={formatLapTime(row.bestLapMs)}
							className={cn(row.hasFastestLap && 'text-fastest')}
						/>
					)}
				</Field>
				<Field label="Tyre" className="px-4 py-2.5">
					{row.compound ? <TyreBadge compound={row.compound} age={row.tyreAge} /> : '-'}
				</Field>
				<Field label="Stops" className="px-4 py-2.5">
					<span className="font-mono">{row.pitStops}</span>
				</Field>
			</div>
			<div className="border-b">
				<GapLadder />
			</div>
			<div className="px-4 py-4">
				<RaceOnly what="Pit stop prediction">
					<ProGate
						feature="Pit stop prediction"
						teaser={`Where ${row.driver.code} comes out if they box this lap, and whether it is into traffic.`}
					>
						<BoxNow driverNumber={row.driver.number} />
					</ProGate>
				</RaceOnly>
			</div>
		</Panel>
	);
}
