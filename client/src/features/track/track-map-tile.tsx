import * as React from 'react';

import { Key, KeyGroup } from '@/components/console/keys';
import { Panel, PanelHeader } from '@/components/console/panel';
import { TrackStatusBadge } from '@/components/track-status-badge';
import { useRace } from '@/data/race-context';
import { usePairShown } from '@/features/watch/pair-context';
import { fights } from '@/insights/battle';
import { hasDrs } from '@/insights/rules';
import type { SectorMark } from '@/insights/standings';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils';

import { useTileFill } from '../dashboard/tile-fill';
import type { TrackMapSettings } from './settings';
import { drsZones, lapsForZones, type Zone } from './drs-zones';
import { type CarLook, MapCanvas } from './map-canvas';
import {
	CarOrder,
	MapNote,
	MapPending,
	placesLabel,
	useMapBodyClass,
	usePlacesNow
} from './map-parts';
import type { MapTheme, Overlay } from './track-draw';
import { type TrackReady, usePlaces, useTrackData } from './use-track';

/** How often the header checks whether the cars on screen are estimated. */
const SOURCE_EVERY_MS = 2000;

const CAMERA_OPTIONS = [
	{ value: 'full', label: 'Circuit' },
	{ value: 'follow', label: 'Follow' }
] as const;

const PAINT_OPTIONS = [
	{ value: 'plain', label: 'Plain' },
	{ value: 'sectors', label: 'Sectors' }
] as const;

/** The DRS zones of the session's circuit, from its lap telemetry; null where they are not known. */
function useDrsZones(track: TrackReady): readonly Zone[] | null {
	const { race, maps } = useRace();
	const lapsPath = track.telemetry?.hasCarData ? track.telemetry.laps : null;
	const drs = hasDrs(race.session);
	const [zones, setZones] = React.useState<{ key: string; zones: Zone[] } | null>(null);

	React.useEffect(() => {
		if (!drs || !lapsPath) {
			return;
		}

		let cancelled = false;

		async function load(path: string) {
			const index = await maps.loadLapIndex(track.sessionKey, path);

			const laps = await Promise.all(
				lapsForZones(index, race.laps).map((entry) => maps.loadLap(track.sessionKey, entry.file))
			);

			if (!cancelled) {
				setZones({ key: track.sessionKey, zones: drsZones(laps) });
			}
		}

		// Zones are a nicety: a failure leaves the map without them.
		load(lapsPath).catch(() => undefined);

		return () => {
			cancelled = true;
		};
	}, [drs, lapsPath, maps, track.sessionKey, race.laps]);

	return drs && zones?.key === track.sessionKey && zones.zones.length > 0 ? zones.zones : null;
}

const MARK_COLOUR: Record<Exclude<SectorMark, 'none'>, keyof MapTheme> = {
	fastest: 'fastest',
	'personal-best': 'personalBest'
};

/** The followed driver's sectors in colour: the mini sectors of the lap in progress live, else the last lap's sectors. */
function useSectorPaint(
	track: TrackReady,
	active: boolean
): { overlays: (theme: MapTheme) => Overlay[]; note: string | null } {
	const { snapshot, standings, followedDriver, live } = useRace();

	return React.useMemo(() => {
		const row = standings.find((entry) => entry.driver.number === followedDriver);

		if (!active || !row) {
			return { overlays: () => [], note: null };
		}

		const { miniSectorStartsM, lengthM, sectorBoundariesM } = track.outline;

		const record = live.following
			? snapshot.miniSectors?.find((entry) => entry.driverNumber === followedDriver)
			: undefined;

		if (record) {
			return {
				note: `${row.driver.code}'s mini sectors on lap ${record.lap}`,
				overlays: (theme: MapTheme) =>
					record.marks.flatMap((mark, index): Overlay[] => {
						if (mark === null || mark === 'none') {
							return [];
						}

						const colour =
							mark === 'fastest'
								? theme.fastest
								: mark === 'personal_best'
									? theme.personalBest
									: theme.flag;

						return [
							{
								fromM: miniSectorStartsM[index] ?? 0,
								toM: miniSectorStartsM[index + 1] ?? lengthM,
								colour
							}
						];
					})
			};
		}

		const edges = [0, sectorBoundariesM[0], sectorBoundariesM[1], lengthM];

		return {
			note: row.lastLap ? `${row.driver.code}'s sectors on lap ${row.lastLap.lap}` : null,
			overlays: (theme: MapTheme) =>
				row.sectorMarks.flatMap((mark, index): Overlay[] =>
					mark === 'none'
						? []
						: [
								{
									fromM: edges[index] ?? 0,
									toM: edges[index + 1] ?? lengthM,
									colour: theme[MARK_COLOUR[mark]]
								}
							]
				)
		};
	}, [active, standings, followedDriver, track.outline, live.following, snapshot.miniSectors]);
}

const NO_SETTINGS: TrackMapSettings = {};

/** Every car on the circuit, from the replay, the live feed, or estimated from timing. */
export function TrackMapTile({
	settings = NO_SETTINGS,
	onSettingsChange
}: {
	settings?: TrackMapSettings;
	onSettingsChange?: (settings: TrackMapSettings) => void;
}) {
	const track = useTrackData();
	const fill = useTileFill();

	return (
		<Panel
			aria-label="Track map"
			className={cn('min-h-0', fill && 'h-full')}
			data-testid="track-map"
		>
			{track.status === 'ready' ? (
				<TrackMapBody track={track} settings={settings} onSettingsChange={onSettingsChange} />
			) : (
				<>
					<PanelHeader title="Track map" />
					<MapPending data={track} />
				</>
			)}
		</Panel>
	);
}

function TrackMapBody({
	track,
	settings,
	onSettingsChange
}: {
	track: TrackReady;
	settings: TrackMapSettings;
	onSettingsChange?: (settings: TrackMapSettings) => void;
}) {
	const { race, snapshot, standings, followedDriver } = useRace();
	const places = usePlaces(track);
	const now = usePlacesNow(places, SOURCE_EVERY_MS);
	const bodyClass = useMapBodyClass();
	const [local, setLocal] = React.useState(settings);
	const camera = local.camera ?? 'full';
	const paint = local.paint ?? 'plain';
	const labels = local.labels ?? 'code';
	const zones = useDrsZones(track);
	const showZones = (local.zones ?? true) && zones !== null;
	const sectors = useSectorPaint(track, paint === 'sectors');
	const followed = race.drivers.find((driver) => driver.number === followedDriver);

	const change = (next: TrackMapSettings) => {
		const merged = { ...local, ...next };

		setLocal(merged);
		onSettingsChange?.(merged);
	};

	const paired = usePairShown();

	// Cars within a second of the one ahead stand out, and so do the fight pointed at and the duel's pair.
	const fighting = React.useMemo(
		() =>
			new Set(
				fights(snapshot, standings).flatMap((fight) =>
					fight.within[0] === 0 ? [fight.ahead.driver.number, fight.behind.driver.number] : []
				)
			),
		[snapshot, standings]
	);

	const look = React.useCallback<CarLook>(
		(driver) => ({
			label: labels === 'number' ? driver.number : driver.code,
			emphasis: paired.has(driver.number) || fighting.has(driver.number)
		}),
		[labels, paired, fighting]
	);

	return (
		<>
			<PanelHeader
				title="Track map"
				headline={
					fighting.size > 0
						? `${plural(fighting.size, 'car')} in a fight, marked`
						: 'No car within a second of another'
				}
				meta={placesLabel(places, now)}
			>
				{/* A narrow tile keeps only the camera and colours keys. */}
				{snapshot.trackStatus === 'green' ? null : (
					<span className="hidden @xl:inline-flex">
						<TrackStatusBadge status={snapshot.trackStatus} />
					</span>
				)}
				<KeyGroup
					label="Camera"
					options={CAMERA_OPTIONS}
					value={camera}
					onChange={(value) => change({ camera: value })}
				/>
				<KeyGroup
					label="Track colours"
					options={PAINT_OPTIONS}
					value={paint}
					onChange={(value) => change({ paint: value })}
				/>
				{/* Secondary keys: a narrow tile keeps the camera and colours. */}
				<Key
					pressed={labels === 'number'}
					title="Label cars by number"
					onClick={() => change({ labels: labels === 'number' ? 'code' : 'number' })}
					className="hidden @xl:inline-flex"
				>
					No.
				</Key>
				{zones ? (
					<Key
						pressed={showZones}
						title="Show the DRS zones"
						onClick={() => change({ zones: !showZones })}
						className="hidden @xl:inline-flex"
					>
						DRS
					</Key>
				) : null}
			</PanelHeader>
			<div className={cn('flex min-h-0', bodyClass)}>
				<MapCanvas
					track={track}
					places={places}
					label={`Track map of ${track.outline.name}${camera === 'follow' && followed ? `, following ${followed.code}` : ''}`}
					overlays={sectors.overlays}
					zones={showZones ? zones : null}
					camera={camera}
					look={look}
				/>
				<CarOrder places={places} />
			</div>
			<MapNote places={places} now={now}>
				{paint === 'sectors' && sectors.note ? <span>{sectors.note}</span> : null}
				{fighting.size > 0 ? <span>Marked: cars in a fight</span> : null}
				{showZones ? <span>Bands: DRS zones</span> : null}
			</MapNote>
		</>
	);
}
