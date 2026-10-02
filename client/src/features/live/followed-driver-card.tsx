import type * as React from 'react';

import { DriverTag } from '@/components/driver-tag';
import { ProGate } from '@/components/pro-gate';
import { TyreBadge } from '@/components/tyre-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useRace } from '@/data/race-context';
import { battleAhead } from '@/insights/battle';
import { predictRejoin } from '@/insights/pit-window';
import { standingsAt } from '@/insights/standings';
import { formatDeltaSeconds, formatLapTime } from '@/lib/format';

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div>
			<div className="text-muted-foreground text-xs">{label}</div>
			<div className="font-mono text-lg font-semibold tabular-nums">{value}</div>
		</div>
	);
}

function BattleSummary({ driverNumber }: { driverNumber: string }) {
	const { snapshot } = useRace();
	const battle = battleAhead(snapshot, driverNumber);

	if (!battle) {
		return <p className="text-muted-foreground text-sm">No car directly ahead on the same lap.</p>;
	}

	const closing = battle.closingSecondsPerLap;

	return (
		<div className="flex flex-col gap-1 text-sm" data-testid="battle-summary">
			<p>
				<span className="font-mono tabular-nums">{battle.intervalSeconds.toFixed(1)}s</span> behind{' '}
				<span className="font-semibold">{battle.ahead.code}</span>
				{closing === null ? null : (
					<span className="text-muted-foreground">
						{' '}
						· {closing > 0 ? 'closing' : 'losing'} {formatDeltaSeconds(Math.abs(closing))}/lap
					</span>
				)}
			</p>
			<p className="text-muted-foreground">
				{battle.lapsToCatch === null
					? 'Not on course to catch at the current pace.'
					: battle.catchesBeforeFlag
						? `On course to catch in about ${battle.lapsToCatch} laps.`
						: `Would need ${battle.lapsToCatch} laps to catch; not before the flag.`}
			</p>
		</div>
	);
}

function PitWindow({ driverNumber }: { driverNumber: string }) {
	const { snapshot } = useRace();
	const prediction = predictRejoin(snapshot, driverNumber);

	if (!prediction) {
		return <p className="text-muted-foreground text-sm">No prediction while the car is out.</p>;
	}

	return (
		<div className="flex flex-col gap-2 text-sm" data-testid="pit-window">
			<div className="flex items-center justify-between gap-2">
				<span className="font-medium">If {prediction.driver.code} pits now</span>
				{prediction.cheapStop ? <Badge variant="warning">Cheap stop</Badge> : null}
			</div>
			<p>
				Rejoins <span className="font-mono font-semibold">P{prediction.rejoinPosition}</span>
				<span className="text-muted-foreground"> from P{prediction.currentPosition}</span>, losing{' '}
				<span className="font-mono tabular-nums">{(prediction.pitLossMs / 1000).toFixed(1)}s</span>.
			</p>
			<ul className="text-muted-foreground flex flex-col gap-0.5">
				{prediction.carAhead ? (
					<li>
						{(prediction.carAhead.gapMs / 1000).toFixed(1)}s behind{' '}
						{prediction.carAhead.driver.code}
					</li>
				) : null}
				{prediction.carBehind ? (
					<li>
						{(prediction.carBehind.gapMs / 1000).toFixed(1)}s ahead of{' '}
						{prediction.carBehind.driver.code}
					</li>
				) : null}
			</ul>
		</div>
	);
}

export function FollowedDriverCard() {
	const { snapshot, followedDriver, setFollowedDriver } = useRace();
	const rows = standingsAt(snapshot);
	const row = rows.find((entry) => entry.driver.number === followedDriver) ?? rows[0];

	if (!row) {
		return null;
	}

	return (
		<Card size="sm" data-testid="followed-driver">
			<CardHeader>
				<CardTitle>Your driver</CardTitle>
				<CardAction>
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
				</CardAction>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col gap-4">
					<DriverTag driver={row.driver} showTeam />
					<div className="grid grid-cols-3 gap-3">
						<Stat label="Position" value={row.state === 'out' ? 'OUT' : `P${row.position}`} />
						<Stat
							label="Last lap"
							value={row.lastLap ? formatLapTime(row.lastLap.lapTimeMs) : '—'}
						/>
						<Stat
							label="Tyre"
							value={row.compound ? <TyreBadge compound={row.compound} age={row.tyreAge} /> : '—'}
						/>
					</div>
					<BattleSummary driverNumber={row.driver.number} />
					<Separator />
					<ProGate feature="Pit window prediction">
						<PitWindow driverNumber={row.driver.number} />
					</ProGate>
				</div>
			</CardContent>
		</Card>
	);
}
