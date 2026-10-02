import NumberFlow from '@number-flow/react';
import type * as React from 'react';

import { Eyebrow, Panel, PanelHeader } from '@/components/console/panel';
import { ProGate } from '@/components/pro-gate';
import { TyreBadge } from '@/components/tyre-badge';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select';
import { useRace } from '@/data/race-context';
import { battleAhead } from '@/insights/battle';
import { standingsAt } from '@/insights/standings';
import { formatLapTime } from '@/lib/format';
import { cn } from '@/lib/utils';

import { BattleGauge } from './battle-gauge';
import { PitWindow } from './pit-window';

function Reading({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-1 px-4 py-3">
			<Eyebrow>{label}</Eyebrow>
			<span className="font-mono text-sm font-semibold">{children}</span>
		</div>
	);
}

export function FocusPanel() {
	const { snapshot, followedDriver, setFollowedDriver } = useRace();
	const rows = standingsAt(snapshot);

	const index = Math.max(
		rows.findIndex((entry) => entry.driver.number === followedDriver),
		0
	);

	const row = rows[index];

	if (!row) {
		return null;
	}

	const behind = rows[index + 1];
	const ahead = battleAhead(snapshot, row.driver.number);

	const chaser =
		behind && behind.state !== 'out' ? battleAhead(snapshot, behind.driver.number) : null;

	const gained = row.positionsGained ?? 0;

	return (
		<Panel aria-label="Followed driver" data-testid="followed-driver">
			<PanelHeader title="Following">
				<Select value={row.driver.number} onValueChange={setFollowedDriver}>
					<SelectTrigger size="sm" aria-label="Followed driver">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{rows.map((entry) => (
							<SelectItem key={entry.driver.number} value={entry.driver.number}>
								{entry.driver.code} · {entry.driver.lastName}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</PanelHeader>
			<div
				className="relative overflow-hidden border-b px-4 py-4"
				style={{ '--team': `#${row.driver.teamColour}` }}
			>
				<span aria-hidden className="bg-team absolute inset-y-0 left-0 w-1" />
				<span aria-hidden className="bg-team/10 absolute inset-0" />
				<div className="relative flex items-end justify-between gap-4">
					<div className="flex min-w-0 flex-col gap-1">
						<span className="text-muted-foreground truncate text-xs">{row.driver.team}</span>
						<span className="font-display truncate text-2xl leading-none font-bold tracking-wide uppercase">
							{row.driver.firstName} {row.driver.lastName}
						</span>
						<span className="text-muted-foreground font-mono text-xs">
							{row.gridPosition === null ? null : `Started P${row.gridPosition}`}
							{gained === 0 ? null : (
								<span className={cn(gained > 0 ? 'text-personal-best' : 'text-primary')}>
									{' '}
									{gained > 0 ? `▲${gained}` : `▼${-gained}`}
								</span>
							)}
						</span>
					</div>
					<span className="font-display text-6xl leading-none font-bold">
						{row.state === 'out' ? (
							'OUT'
						) : (
							<NumberFlow value={row.position} prefix="P" aria-label={`Position ${row.position}`} />
						)}
					</span>
				</div>
			</div>
			<div className="grid grid-cols-2 divide-x border-b sm:grid-cols-4">
				<Reading label="Last lap">
					{row.lastLap ? formatLapTime(row.lastLap.lapTimeMs) : '—'}
				</Reading>
				<Reading label="Best">
					<span className={cn(row.hasFastestLap && 'text-fastest')}>
						{row.bestLapMs === null ? '—' : formatLapTime(row.bestLapMs)}
					</span>
				</Reading>
				<Reading label="Tyre">
					{row.compound ? <TyreBadge compound={row.compound} age={row.tyreAge} /> : '—'}
				</Reading>
				<Reading label="Stops">{row.pitStops}</Reading>
			</div>
			<div className="flex flex-col gap-5 border-b px-4 py-4" data-testid="battle-summary">
				{ahead ? (
					<BattleGauge
						label="Ahead"
						driver={ahead.ahead}
						gapSeconds={ahead.intervalSeconds}
						closingSecondsPerLap={ahead.closingSecondsPerLap}
						lapsToCatch={ahead.catchesBeforeFlag ? ahead.lapsToCatch : null}
					/>
				) : (
					<p className="text-muted-foreground text-sm">
						{row.position === 1 ? 'Leading the race.' : 'No car directly ahead on the same lap.'}
					</p>
				)}
				{chaser && behind ? (
					<BattleGauge
						label="Behind"
						driver={behind.driver}
						gapSeconds={chaser.intervalSeconds}
						closingSecondsPerLap={chaser.closingSecondsPerLap}
					/>
				) : null}
			</div>
			<div className="px-4 py-4">
				<ProGate feature="Pit window prediction">
					<PitWindow driverNumber={row.driver.number} />
				</ProGate>
			</div>
		</Panel>
	);
}
