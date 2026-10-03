import type { Driver, LapIndex, RaceSnapshot } from '@f1-live/shared';
import { XIcon } from 'lucide-react';
import * as React from 'react';

import { Digits } from '@/components/console/digits';
import { Key, KeyGroup } from '@/components/console/keys';
import { Panel, PanelHeader } from '@/components/console/panel';
import { TeamStripe } from '@/components/driver-tag';
import { ProGate } from '@/components/pro-gate';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select';
import { useRace } from '@/data/race-context';
import { stepTime } from '@/data/session-time';
import type { TelemetrySource } from '@/data/telemetry-source';
import { cn } from '@/lib/utils';

import { useCompare } from '../analysis/compare-context';
import { useTileFill } from '../dashboard/tile-fill';
import { bestOf, type Dominance, dominance, miniSectorTimes } from './dominance';
import { type CarLook, MapCanvas } from './map-canvas';
import { MapPending, useMapBodyClass } from './map-parts';
import type { Overlay } from './track-draw';
import { type TrackReady, usePlaces, useTrackData } from './use-track';

export type DominanceSpan = 'lap' | 'best';

const SPAN_OPTIONS = [
	{ value: 'lap', label: 'Best lap' },
	{ value: 'best', label: 'Best minis' }
] as const;

/** Drivers compared at most. */
const MAX_DRIVERS = 3;

/** In "best minis", the fastest few laps of each driver are read: where the best minis come from. */
const LAPS_READ = 8;

/** Where the times come from, which says how far they can be trusted. */
type TimesSource = 'positions' | 'loops' | 'sectors';

type Times = {
	/** Per driver, the time through each mini sector (or sector). */
	times: ReadonlyMap<string, readonly (number | null)[]>;
	leaders: readonly (string | null)[];
	source: TimesSource;
};

type LapEntry = LapIndex['laps'][number];

function usable(entry: LapEntry, until: number): boolean {
	return (
		!entry.partial &&
		!entry.pitIn &&
		!entry.pitOut &&
		Date.parse(entry.startedAt) + entry.lapTimeMs <= until
	);
}

/** The laps to read per driver: the fastest lap, or the fastest few for the best of each mini sector. */
export function lapsToRead(
	index: LapIndex,
	drivers: readonly string[],
	span: DominanceSpan,
	until: number
): LapEntry[] {
	return drivers.flatMap((driverNumber) =>
		index.laps
			.filter((entry) => entry.driverNumber === driverNumber && usable(entry, until))
			.toSorted((a, b) => a.lapTimeMs - b.lapTimeMs)
			.slice(0, span === 'lap' ? 1 : LAPS_READ)
	);
}

async function timesFromLaps(
	telemetry: TelemetrySource,
	track: TrackReady,
	lapsPath: string,
	drivers: readonly string[],
	span: DominanceSpan,
	until: number
): Promise<Times> {
	const index = await telemetry.loadLapIndex(track.sessionKey, lapsPath);
	const entries = lapsToRead(index, drivers, span, until);

	const laps = await Promise.all(
		entries.map((entry) => telemetry.loadLap(track.sessionKey, entry.file))
	);

	const perDriver = new Map<string, (number | null)[][]>();

	for (const lap of laps) {
		const own = perDriver.get(lap.driverNumber) ?? [];

		own.push(miniSectorTimes(track.outline, { distanceM: lap.d, timeMs: lap.t }));
		perDriver.set(lap.driverNumber, own);
	}

	return {
		times: new Map(drivers.map((driver) => [driver, bestOf(perDriver.get(driver) ?? [])])),
		leaders: [],
		source: 'positions'
	};
}

/** Live, or a session saved with them: the timing loops' mini sectors and their purple holders. */
function timesFromLoops(
	snapshot: RaceSnapshot,
	drivers: readonly string[],
	span: DominanceSpan
): Times | null {
	const records = new Map(
		(snapshot.miniSectors ?? []).map((record) => [record.driverNumber, record])
	);

	if (!drivers.some((driver) => records.has(driver))) {
		return null;
	}

	return {
		times: new Map(
			drivers.map((driver) => [
				driver,
				(span === 'lap' ? records.get(driver)?.lastMs : records.get(driver)?.bestMs) ?? []
			])
		),
		leaders: span === 'best' ? (snapshot.miniSectorLeaders ?? []) : [],
		source: 'loops'
	};
}

/** Without mini sectors: each driver's three sectors, from the fastest lap or the best of each. */
function timesFromSectors(
	snapshot: RaceSnapshot,
	drivers: readonly string[],
	span: DominanceSpan
): Times {
	const times = new Map(
		drivers.map((driver) => {
			const laps = snapshot.laps.filter(
				(lap) =>
					lap.driverNumber === driver &&
					lap.lapTimeMs > 0 &&
					lap.sectorTimesMs.every((time) => time > 0)
			);

			const fastest = laps.reduce<(typeof laps)[number] | null>(
				(best, lap) => (!best || lap.lapTimeMs < best.lapTimeMs ? lap : best),
				null
			);

			const sectors =
				span === 'lap'
					? fastest
						? [fastest.sectorTimesMs]
						: []
					: laps.map((lap) => lap.sectorTimesMs);

			return [driver, bestOf(sectors)] as const;
		})
	);

	return { times, leaders: [], source: 'sectors' };
}

type Loaded = { key: string; times: Times | null; failed: boolean };

/** The times compared, from the best source the session has. */
function useTimes(
	track: TrackReady,
	drivers: readonly string[],
	span: DominanceSpan
): Times | null {
	const { telemetry, snapshot, timeline, lap, live } = useRace();
	const lapsPath = live.following ? null : track.telemetry?.laps;
	const until = timeline ? stepTime(timeline, lap) : 0;
	const key = `${track.sessionKey}/${drivers.join(',')}/${span}/${until}`;
	const [loaded, setLoaded] = React.useState<Loaded | null>(null);

	React.useEffect(() => {
		if (!lapsPath || drivers.length === 0) {
			return;
		}

		let cancelled = false;

		async function load(path: string) {
			let next: Loaded;

			try {
				next = {
					key,
					times: await timesFromLaps(telemetry, track, path, drivers, span, until),
					failed: false
				};
			} catch {
				next = { key, times: null, failed: true };
			}

			if (!cancelled) {
				setLoaded(next);
			}
		}

		void load(lapsPath);

		return () => {
			cancelled = true;
		};
	}, [lapsPath, telemetry, track, drivers, span, until, key]);

	if (lapsPath && !(loaded?.key === key && loaded.failed)) {
		// Keep the last picture while the next lap loads, so stepping does not flash.
		return loaded?.times ?? null;
	}

	return timesFromLoops(snapshot, drivers, span) ?? timesFromSectors(snapshot, drivers, span);
}

const SOURCE_NOTE: Record<TimesSource, string> = {
	positions: 'Timed from car positions on each lap.',
	loops: 'Timed between the timing loops, a tenth or so either way; purple holders are exact.',
	sectors: 'Whole sectors only: this session has no mini-sector times.'
};

/** The compared drivers, at most three, the followed driver first when compared. */
function useChosen(): readonly Driver[] {
	const { compared } = useCompare();
	const { followedDriver } = useRace();

	return React.useMemo(
		() =>
			compared
				.toSorted(
					(a, b) => Number(b.number === followedDriver) - Number(a.number === followedDriver)
				)
				.slice(0, MAX_DRIVERS),
		[compared, followedDriver]
	);
}

/** Painted by who is quickest in each mini sector among two or three drivers. */
export function DominanceTile({
	span: initialSpan = 'best',
	onSpanChange
}: {
	span?: DominanceSpan;
	onSpanChange?: (span: DominanceSpan) => void;
}) {
	const track = useTrackData();
	const fill = useTileFill();
	const [span, setLocalSpan] = React.useState<DominanceSpan>(initialSpan);

	const setSpan = (next: DominanceSpan) => {
		setLocalSpan(next);
		onSpanChange?.(next);
	};

	return (
		<Panel
			aria-label="Mini-sector dominance"
			className={cn('min-h-0', fill && 'h-full')}
			data-testid="dominance"
		>
			<PanelHeader title="Dominance">
				<KeyGroup label="Times compared" options={SPAN_OPTIONS} value={span} onChange={setSpan} />
			</PanelHeader>
			<ProGate
				feature="Mini-sector dominance"
				teaser="The circuit painted by who is quickest in each mini sector, live through qualifying."
			>
				{track.status === 'ready' ? (
					<DominanceBody track={track} span={span} />
				) : (
					<MapPending data={track} />
				)}
			</ProGate>
		</Panel>
	);
}

function DominanceBody({ track, span }: { track: TrackReady; span: DominanceSpan }) {
	const places = usePlaces(track);
	const bodyClass = useMapBodyClass();
	const chosen = useChosen();
	const { running, toggle } = useCompare();
	const numbers = React.useMemo(() => chosen.map((driver) => driver.number), [chosen]);
	const times = useTimes(track, numbers, span);

	const result = React.useMemo(
		() => (times ? dominance(numbers, times.times, times.leaders) : null),
		[numbers, times]
	);

	// A second car of the same team is dashed rather than given an invented colour.
	const dashed = React.useMemo(
		() =>
			new Set(
				chosen
					.filter(
						(driver, index) => chosen.findIndex((other) => other.team === driver.team) !== index
					)
					.map((driver) => driver.number)
			),
		[chosen]
	);

	const overlays = React.useCallback(
		(): Overlay[] => (result && times ? paint(track, result, times.source, chosen, dashed) : []),
		[result, times, track, chosen, dashed]
	);

	const look = React.useCallback<CarLook>(
		(driver) =>
			numbers.includes(driver.number)
				? { label: driver.code, emphasis: true, dashed: dashed.has(driver.number) }
				: null,
		[numbers, dashed]
	);

	return (
		<>
			<div className={cn('flex min-h-0 flex-col', bodyClass)}>
				<MapCanvas
					track={track}
					places={places}
					label={`Mini-sector dominance on ${track.outline.name} between ${chosen.map((driver) => driver.code).join(', ')}`}
					camera="full"
					overlays={overlays}
					look={look}
				/>
			</div>
			<div className="flex flex-wrap items-stretch border-t" data-testid="dominance-legend">
				{chosen.map((driver) => (
					<div
						key={driver.number}
						className="flex min-w-36 flex-1 items-center gap-3 border-r px-4 py-2"
					>
						<TeamStripe driver={driver} className={cn(dashed.has(driver.number) && 'opacity-60')} />
						<span className="flex flex-col">
							<span className="type-wide text-sm font-bold">{driver.code}</span>
							<span className="type-label whitespace-nowrap">
								{result
									? `${result.won.get(driver.number) ?? 0}/${result.winners.filter((winner) => winner !== null).length} ${times?.source === 'sectors' ? 'sectors' : 'minis'}`
									: '-'}
							</span>
						</span>
						{result ? (
							<Digits
								value={`+${((result.lostMs.get(driver.number) ?? 0) / 1000).toFixed(3)}`}
								className="ml-auto text-sm"
							/>
						) : null}
						<Key
							aria-label={`Stop comparing ${driver.code}`}
							className="px-1 sm:px-1"
							onClick={() => toggle(driver.code)}
							disabled={chosen.length <= 1}
						>
							<XIcon />
						</Key>
					</div>
				))}
				{chosen.length < MAX_DRIVERS ? (
					<div className="flex items-center px-4 py-2">
						<Select value="" onValueChange={toggle}>
							<SelectTrigger size="sm" aria-label="Add a driver to compare">
								<SelectValue placeholder="Add driver" />
							</SelectTrigger>
							<SelectContent>
								{running
									.filter((row) => !numbers.includes(row.driver.number))
									.map((row) => (
										<SelectItem key={row.driver.number} value={row.driver.code}>
											{row.driver.code} {row.driver.lastName}
										</SelectItem>
									))}
							</SelectContent>
						</Select>
					</div>
				) : null}
			</div>
			<p className="text-muted-foreground border-t px-4 py-2 text-xs" data-testid="dominance-note">
				{times
					? `${SOURCE_NOTE[times.source]} Each driver's figure is the time lost to the quickest, summed.`
					: 'Reading the laps…'}
			</p>
		</>
	);
}

function paint(
	track: TrackReady,
	result: Dominance,
	source: TimesSource,
	chosen: readonly Driver[],
	dashed: ReadonlySet<string>
): Overlay[] {
	const { outline } = track;
	const colours = new Map(chosen.map((driver) => [driver.number, `#${driver.teamColour}`]));

	const starts =
		source === 'sectors' ? [0, ...outline.sectorBoundariesM] : outline.miniSectorStartsM;

	return result.winners.flatMap((winner, index): Overlay[] => {
		const colour = winner === null ? undefined : colours.get(winner);

		return winner === null || colour === undefined
			? []
			: [
					{
						fromM: starts[index] ?? 0,
						toM: starts[index + 1] ?? outline.lengthM,
						colour,
						dashed: dashed.has(winner),
						width: 1.15
					}
				];
	});
}
