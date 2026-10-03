import { ChevronsUpDownIcon } from 'lucide-react';
import * as React from 'react';

import { Key } from '@/components/console/keys';
import { Field, Panel, PanelHeader } from '@/components/console/panel';
import { LapStrip } from '@/components/lap-strip';
import { LapCounter, LiveKey, Transport } from '@/components/race-clock';
import { TrackStatusBadge } from '@/components/track-status-badge';
import { formatLocalStart, SESSION_TYPE_LABEL } from '@/data/catalog';
import { useRace } from '@/data/race-context';
import { useNow } from '@/hooks/use-now';

import { SessionPickerDialog } from './session-picker';

/** Where the data on screen comes from, in a word. */
function useFeedLabel(): string {
	const { race, live, sourceKind } = useRace();
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
 * not in a ruled panel: these are the screen's masthead, wherever a viewer moves them. Its
 * Sessions key opens the picker for any other session.
 */
export function SessionTile() {
	const { race, snapshot, sessionError } = useRace();
	const [picking, setPicking] = React.useState(false);
	const year = new Date(race.session.startsAt).getUTCFullYear();
	const feed = useFeedLabel();

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
				<Field label="Feed" className="px-4">
					{feed === 'Upcoming' ? formatLocalStart(race.session.startsAt) : feed}
				</Field>
				<Field label="Track" className="px-4">
					<TrackStatusBadge status={snapshot.trackStatus} />
				</Field>
				<div className="pl-4">
					<Key onClick={() => setPicking(true)} aria-haspopup="dialog">
						Sessions
						<ChevronsUpDownIcon aria-hidden />
					</Key>
				</div>
			</div>
			{sessionError ? (
				<p role="alert" className="text-danger text-xs">
					{sessionError}
				</p>
			) : null}
			<SessionPickerDialog open={picking} onOpenChange={setPicking} />
		</section>
	);
}

/** Transport keys and the lap; on a live session, the live key and the connection. */
export function ReplayTile() {
	return (
		<section
			aria-label="Replay"
			className="@container flex h-full min-w-0 flex-wrap items-end justify-between gap-x-5 gap-y-3 py-2 @xs:justify-end"
		>
			<LiveKey />
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
