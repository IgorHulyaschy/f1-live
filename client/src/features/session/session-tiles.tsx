import { Field, Panel, PanelHeader } from '@/components/console/panel';
import { LapStrip } from '@/components/lap-strip';
import { LapCounter, Transport } from '@/components/race-clock';
import { TrackStatusBadge } from '@/components/track-status-badge';
import { useRace } from '@/data/race-context';

const SESSION_LABEL = {
	race: 'Race',
	sprint: 'Sprint',
	qualifying: 'Qualifying',
	sprint_qualifying: 'Sprint Qualifying',
	practice: 'Practice'
} as const;

/**
 * The race title and its facts. Like the replay and lap strip tiles it sits on the page itself,
 * not in a ruled panel: these are the screen's masthead, wherever a viewer moves them.
 */
export function SessionTile() {
	const { race, snapshot, sourceKind } = useRace();
	const year = new Date(race.session.startsAt).getUTCFullYear();

	return (
		<section
			aria-label="Session"
			className="@container flex h-full min-w-0 flex-col justify-end gap-3 py-2"
			data-testid="session"
		>
			<h2 className="type-wide truncate text-2xl leading-none font-black italic @2xl:text-4xl">
				{race.session.meetingName.replace(/ Grand Prix$/, '')}
				<span className="text-muted-foreground"> GP {year}</span>
			</h2>
			<div className="flex flex-wrap gap-y-2 divide-x">
				<Field label="Circuit" className="pr-4">
					{race.session.circuit}
				</Field>
				<Field label="Session" className="px-4">
					{SESSION_LABEL[race.session.type]}
				</Field>
				<Field label="Feed" className="px-4">
					{sourceKind === 'mock' ? 'Replay' : 'Live'}
				</Field>
				<Field label="Track" className="pl-4">
					<TrackStatusBadge status={snapshot.trackStatus} />
				</Field>
			</div>
		</section>
	);
}

/** Transport keys and the lap. */
export function ReplayTile() {
	return (
		<section
			aria-label="Replay"
			className="@container flex h-full min-w-0 flex-wrap items-end justify-between gap-x-5 gap-y-3 py-2 @xs:justify-end"
		>
			<Transport />
			<LapCounter />
		</section>
	);
}

export function LapStripTile() {
	return (
		<section aria-label="Laps" className="flex h-full min-w-0 flex-col justify-end py-1">
			<LapStrip />
		</section>
	);
}

/** Conditions at the selected lap. */
export function WeatherTile() {
	const { snapshot } = useRace();
	const sample = snapshot.weather.at(-1);

	return (
		<Panel aria-label="Weather" data-testid="weather">
			<PanelHeader title="Weather" meta={sample ? `Lap ${sample.lap}` : undefined} />
			{sample ? (
				<dl className="grid grid-cols-2 @xs:grid-cols-3 @lg:grid-cols-5">
					{[
						['Air', `${sample.airTempC.toFixed(1)}°`],
						['Track', `${sample.trackTempC.toFixed(1)}°`],
						['Humidity', `${sample.humidityPct}%`],
						['Wind', `${sample.windSpeedMs.toFixed(1)} m/s`],
						['Rain', sample.rainfall ? 'Yes' : 'No']
					].map(([label, value]) => (
						<div key={label} className="flex flex-col border-b px-4 py-2.5">
							<dt className="type-label">{label}</dt>
							<dd className="font-mono text-lg font-bold">{value}</dd>
						</div>
					))}
				</dl>
			) : (
				<p className="text-muted-foreground px-4 py-3 text-sm">No weather from this feed yet.</p>
			)}
		</Panel>
	);
}
