import { EmptyNote } from '@/components/console/empty-note';
import { Field, Panel, PanelHeader } from '@/components/console/panel';
import { LapStrip } from '@/components/lap-strip';
import { TrackStatusBadge } from '@/components/track-status-badge';
import { formatLocalStart, formatUntil, SESSION_TYPE_LABEL } from '@/data/catalog';
import { useRaceView } from '@/data/race-context';
import { useNow } from '@/hooks/use-now';

/** Where the data on screen comes from, in a word. */
export function useFeedLabel(): 'Live' | 'Replay' | 'Upcoming' | 'No data' {
	const { race, live, sourceKind } = useRaceView();
	const now = useNow();

	if (live.isLive) {
		return 'Live';
	}

	if (sourceKind === 'mock' || race.laps.length > 0) {
		return 'Replay';
	}

	return Date.parse(race.session.startsAt) > now ? 'Upcoming' : 'No data';
}

/**
 * The race title and its facts. Like the replay and lap strip tiles it sits on the page itself,
 * not in a ruled panel: these are the screen's masthead, wherever a viewer moves them. The
 * Sessions and Jump to the finish keys are on the live strip, on every page.
 */
export function SessionTile() {
	const { race, snapshot } = useRaceView();
	const year = new Date(race.session.startsAt).getUTCFullYear();
	const feed = useFeedLabel();
	const now = useNow();
	const startsMs = Date.parse(race.session.startsAt);

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
			<div className="flex flex-wrap items-end gap-y-2 divide-x">
				<Field label="Circuit" className="pr-4">
					{race.session.circuit}
				</Field>
				<Field label="Session" className="px-4">
					{race.session.name ?? SESSION_TYPE_LABEL[race.session.type]}
				</Field>
				{feed === 'Upcoming' ? (
					<>
						<Field label="Starts" className="px-4">
							{formatLocalStart(race.session.startsAt)}
						</Field>
						<Field label="In" className="px-4">
							{formatUntil(now, startsMs)}
						</Field>
					</>
				) : (
					<Field label="Feed" className="px-4">
						{feed}
					</Field>
				)}
				<Field label="Track" className="pl-4">
					<TrackStatusBadge status={snapshot.trackStatus} />
				</Field>
			</div>
		</section>
	);
}

export function LapStripTile() {
	const { race, stepUnit } = useRaceView();
	const empty = stepUnit === 'lap' ? race.session.totalLaps === 0 : race.laps.length === 0;

	return (
		<section aria-label="Laps" className="flex h-full min-w-0 flex-col justify-end py-1">
			{empty ? <EmptyNote className="px-0 py-1" /> : <LapStrip />}
		</section>
	);
}

/** Conditions at the selected lap. */
export function WeatherTile() {
	const { snapshot } = useRaceView();
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
