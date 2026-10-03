import type { Driver } from '@f1-live/shared';
import * as React from 'react';

import { Digits } from '@/components/console/digits';
import { EmptyNote } from '@/components/console/empty-note';
import { Panel, PanelHeader } from '@/components/console/panel';
import { TeamStripe } from '@/components/driver-tag';
import { useRace } from '@/data/race-context';
import { DriverLink } from '@/features/drill/drill-parts';
import { battleAhead } from '@/insights/battle';
import { isTimedSession } from '@/insights/qualifying';
import { ONE_SECOND_MS, oneSecondAid } from '@/insights/rules';
import { formatDeltaSeconds } from '@/lib/format';
import { cn } from '@/lib/utils';

import { useTileFill } from '../dashboard/tile-fill';
import { lapsUntilInRange, roadGapMs, roadNeighbours } from './battle';
import { type CarLook, type ExtraDraw, MapCanvas } from './map-canvas';
import { MapNote, MapPending, useMapBodyClass, usePlacesNow } from './map-parts';
import { toScreen } from './track-draw';
import type { CarPlace } from './track-frames';
import { type PlacesSampler, type TrackReady, usePlaces, useTrackData } from './use-track';

/** Gaps on the road are measured again this often. */
const GAP_EVERY_MS = 500;

type Rival = { driver: Driver; side: 'ahead' | 'behind' };

/**
 * The cars either side of the followed driver: in a race the places ahead and behind in the
 * running order; in practice and qualifying, the nearest cars on the road, which are traffic.
 */
function useRivals(cars: readonly CarPlace[] | null, lengthM: number): Rival[] {
	const { race, standings, followedDriver } = useRace();
	const timed = isTimedSession(race.session.type);
	const drivers = new Map(race.drivers.map((driver) => [driver.number, driver]));

	if (timed) {
		const near = roadNeighbours(cars ?? [], followedDriver, lengthM);

		return [
			...(near.ahead === null ? [] : [{ number: near.ahead, side: 'ahead' as const }]),
			...(near.behind === null ? [] : [{ number: near.behind, side: 'behind' as const }])
		].flatMap(({ number, side }) => {
			const driver = drivers.get(number);

			return driver ? [{ driver, side }] : [];
		});
	}

	const running = standings.filter((row) => row.state !== 'out');
	const index = running.findIndex((row) => row.driver.number === followedDriver);
	const ahead = index > 0 ? running[index - 1] : undefined;
	const behind = index >= 0 ? running[index + 1] : undefined;

	return [
		...(ahead ? [{ driver: ahead.driver, side: 'ahead' as const }] : []),
		...(behind ? [{ driver: behind.driver, side: 'behind' as const }] : [])
	];
}

/** The road gap to each rival now, in ms, measured on the places the map draws. */
function useRoadGaps(
	places: PlacesSampler,
	rivals: readonly Rival[],
	time: number | null,
	timed: boolean
): Map<string, number> {
	const { followedDriver } = useRace();
	const { placeAt } = places;

	return React.useMemo(() => {
		const gaps = new Map<string, number>();

		if (time === null) {
			return gaps;
		}

		const progressAt = (driverNumber: string, at: number) =>
			placeAt(driverNumber, at)?.progress ?? null;

		for (const rival of rivals) {
			const [ahead, behind] =
				rival.side === 'ahead'
					? [rival.driver.number, followedDriver]
					: [followedDriver, rival.driver.number];

			// Off a race, the car ahead on the road can be laps up: compare within the lap. In a race
			// a lapped car has no road gap to its rival, as in the timing.
			const lapsUp = timed
				? Math.floor((progressAt(ahead, time) ?? 0) - (progressAt(behind, time) ?? 0))
				: 0;

			const withinLap = (driverNumber: string, at: number) => {
				const progress = progressAt(driverNumber, at);

				return progress !== null && driverNumber === ahead ? progress - lapsUp : progress;
			};

			const gap = roadGapMs(withinLap, ahead, behind, time);

			if (gap !== null) {
				gaps.set(rival.driver.number, gap);
			}
		}

		return gaps;
	}, [placeAt, rivals, time, timed, followedDriver]);
}

/**
 * What the gap is doing, in pit-wall words: whether the chaser reaches the one-second window, and
 * when. Ahead, the followed driver is the chaser; behind, the rival is.
 */
function rangeText(
	side: Rival['side'],
	timed: boolean,
	intervalS: number | null,
	closing: number | null,
	laps: number | null,
	aid: string
): string {
	if (timed) {
		return intervalS !== null && intervalS < 2 ? 'Close traffic' : 'Clear';
	}

	if (laps === 0) {
		return `In ${aid} range`;
	}

	if (laps !== null) {
		return `In range in ${laps} ${laps === 1 ? 'lap' : 'laps'}`;
	}

	if (closing !== null && closing < -0.05) {
		return side === 'ahead' ? 'Pulling away' : 'Dropping back';
	}

	return 'Holding';
}

function RivalReading({
	rival,
	gapMs,
	timed
}: {
	rival: Rival;
	gapMs: number | undefined;
	timed: boolean;
}) {
	const { snapshot, followedDriver } = useRace();
	const aid = oneSecondAid(snapshot);
	const chaser = rival.side === 'ahead' ? followedDriver : rival.driver.number;
	const battle = timed ? null : battleAhead(snapshot, chaser);
	const intervalS = gapMs === undefined ? (battle?.intervalSeconds ?? null) : gapMs / 1000;
	const closing = battle?.closingSecondsPerLap ?? null;

	const laps =
		intervalS === null ? null : lapsUntilInRange(intervalS, closing, ONE_SECOND_MS / 1000);

	const range = rangeText(rival.side, timed, intervalS, closing, laps, aid.code);

	return (
		<div className="flex min-w-0 flex-col gap-1 px-4 py-2.5" data-testid={`battle-${rival.side}`}>
			<span className="type-label">{rival.side === 'ahead' ? 'Ahead' : 'Behind'}</span>
			<span className="flex items-center gap-2">
				<DriverLink driver={rival.driver} className="flex items-center gap-2">
					<TeamStripe driver={rival.driver} />
					<span className="type-wide text-sm font-bold">{rival.driver.code}</span>
				</DriverLink>
				{intervalS === null ? (
					<span className="text-muted-foreground font-mono text-sm">-</span>
				) : (
					<Digits
						value={`${rival.side === 'ahead' ? '−' : '+'}${intervalS.toFixed(3)}`}
						className="text-sm"
					/>
				)}
			</span>
			<span className="text-muted-foreground flex flex-wrap gap-x-3 font-mono text-xs">
				{closing !== null && !timed ? (
					<span title="Pace difference per lap, from the last five clean laps">
						{formatDeltaSeconds(rival.side === 'ahead' ? closing : -closing, 2)}/lap
					</span>
				) : null}
				<span className={cn(laps === 0 && !timed && 'text-foreground font-bold')}>{range}</span>
			</span>
		</div>
	);
}

/** The followed driver's fight on the circuit: the cars either side, the gaps on the road and how they move. */
export function BattleMapTile() {
	const track = useTrackData();
	const fill = useTileFill();

	return (
		<Panel
			aria-label="Battle map"
			className={cn('min-h-0', fill && 'h-full')}
			data-testid="battle-map"
		>
			{track.status === 'ready' ? (
				<BattleMapBody track={track} />
			) : (
				<>
					<PanelHeader title="Battle map" />
					<MapPending data={track} />
				</>
			)}
		</Panel>
	);
}

function BattleMapBody({ track }: { track: TrackReady }) {
	const { race, followedDriver } = useRace();
	const places = usePlaces(track);
	const bodyClass = useMapBodyClass();
	const now = usePlacesNow(places, GAP_EVERY_MS);
	const rivals = useRivals(now?.cars ?? null, track.outline.lengthM);
	const timed = isTimedSession(race.session.type);
	const gaps = useRoadGaps(places, rivals, now?.time ?? null, timed);
	const followed = race.drivers.find((driver) => driver.number === followedDriver);

	const watched = React.useMemo(
		() => [followedDriver, ...rivals.map((rival) => rival.driver.number)],
		[followedDriver, rivals]
	);

	const watchedKey = watched.join(',');
	const focus = React.useMemo(() => watchedKey.split(','), [watchedKey]);

	const look = React.useCallback<CarLook>(
		// Only the cars in the fight are named; the rest are traffic.
		(driver) =>
			focus.includes(driver.number) ? { label: driver.code, emphasis: true } : { label: '' },
		[focus]
	);

	// The gap to each rival, printed on the track between the two cars.
	const extra = React.useCallback<ExtraDraw>(
		({ ctx, rem, theme }, view, cars) => {
			const subject = cars.find((car) => car.driverNumber === followedDriver);
			const unit = rem / 16;

			if (!subject) {
				return;
			}

			for (const rival of rivals) {
				const other = cars.find((car) => car.driverNumber === rival.driver.number);
				const gap = gaps.get(rival.driver.number);

				if (!other || gap === undefined) {
					continue;
				}

				const [ax, ay] = toScreen(view, [subject.x, subject.y]);
				const [bx, by] = toScreen(view, [other.x, other.y]);
				const text = `${(gap / 1000).toFixed(1)}s`;

				ctx.font = `700 ${Math.round(11 * unit)}px "Martian Mono Variable", ui-monospace, monospace`;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.setLineDash([3 * unit, 3 * unit]);
				ctx.strokeStyle = theme.foreground;
				ctx.globalAlpha = 0.5;
				ctx.lineWidth = 1.25 * unit;
				ctx.beginPath();
				ctx.moveTo(ax, ay);
				ctx.lineTo(bx, by);
				ctx.stroke();
				ctx.setLineDash([]);
				ctx.globalAlpha = 1;
				ctx.lineWidth = 4 * unit;
				ctx.strokeStyle = theme.panel;
				ctx.strokeText(text, (ax + bx) / 2, (ay + by) / 2);
				ctx.fillStyle = theme.foreground;
				ctx.fillText(text, (ax + bx) / 2, (ay + by) / 2);
			}
		},
		[rivals, gaps, followedDriver]
	);

	if (!followed) {
		return (
			<>
				<PanelHeader title="Battle map" />
				<EmptyNote />
			</>
		);
	}

	return (
		<>
			<PanelHeader title="Battle map" meta={followed.code} />
			<div className={cn('flex min-h-0 flex-col', bodyClass)}>
				<MapCanvas
					track={track}
					places={places}
					label={`Battle map: ${followed.code} and the cars either side on ${track.outline.name}`}
					camera="battle"
					focus={focus}
					look={look}
					extra={extra}
				/>
			</div>
			<div className="grid grid-cols-2 divide-x border-t" aria-live="off">
				{(['ahead', 'behind'] as const).map((side) => {
					const rival = rivals.find((entry) => entry.side === side);

					return rival ? (
						<RivalReading
							key={side}
							rival={rival}
							gapMs={gaps.get(rival.driver.number)}
							timed={timed}
						/>
					) : (
						<div key={side} className="flex flex-col gap-1 px-4 py-2.5">
							<span className="type-label">{side === 'ahead' ? 'Ahead' : 'Behind'}</span>
							<span className="text-muted-foreground text-sm">
								{side === 'ahead' && !timed ? 'Leading' : 'Clear'}
							</span>
						</div>
					);
				})}
			</div>
			<MapNote places={places} now={now} />
		</>
	);
}
