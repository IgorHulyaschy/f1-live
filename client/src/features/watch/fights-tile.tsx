import { m } from 'motion/react';
import * as React from 'react';

import { Digits } from '@/components/console/digits';
import { EmptyNote } from '@/components/console/empty-note';
import { Panel, PanelHeader } from '@/components/console/panel';
import { WholeRows } from '@/components/console/whole-rows';
import { DriverPortrait } from '@/components/driver-media';
import { DriverTag } from '@/components/driver-tag';
import { RaceOnly } from '@/components/race-only';
import { compoundName } from '@/components/tyre-badge';
import { useRace } from '@/data/race-context';
import { FIGHT_GAP_SECONDS, type Fight, fights } from '@/insights/battle';
import { pausingFlag } from '@/insights/clean-laps';
import { fightsHeadline } from '@/insights/headlines';
import { lapRangeText } from '@/insights/duel';
import { oneSecondAid } from '@/insights/rules';
import { cn } from '@/lib/utils';

import { type Pair, usePair } from './pair-context';

/** The gap bars run to this many seconds at least, so a fight a tenth apart still reads as close. */
const MIN_SCALE_SECONDS = 2;

/** How far ahead the bar's arrow looks: where the gap will be in this many laps at this pace. */
const ARROW_LAPS = 3;

function reasonText(fight: Fight): string | null {
	const { reason } = fight;

	switch (reason?.kind) {
		case 'fresh-tyres': {
			return `Stopped ${reason.lapsSinceStop} ${reason.lapsSinceStop === 1 ? 'lap' : 'laps'} ago`;
		}

		case 'compound': {
			return `${compoundName(reason.behind)} against ${compoundName(reason.ahead).toLowerCase()}`;
		}

		case 'tyre-age': {
			return `Tyres ${reason.newerLaps} laps newer`;
		}

		default: {
			return null;
		}
	}
}

function paceText(fight: Fight): string | null {
	const rate = fight.pace?.secondsPerLap;

	if (rate === undefined || Math.abs(rate) < 0.05) {
		return fight.pace ? 'Matched on pace' : null;
	}

	return rate > 0 ? `${rate.toFixed(1)} s a lap faster` : 'Losing touch';
}

/**
 * The gap now as a bar from the car ahead, with the one-second window shaded at its start and an
 * arrow to where the gap will be in a few laps at the pace of the last clean laps.
 */
function GapBar({ fight, scale }: { fight: Fight; scale: number }) {
	const rate = fight.pace?.secondsPerLap ?? 0;
	const later = Math.min(Math.max(fight.gapSeconds - ARROW_LAPS * rate, 0), scale);
	const now = Math.min(fight.gapSeconds, scale);
	const percent = (seconds: number) => `${(seconds / scale) * 100}%`;

	return (
		<span aria-hidden className="relative block h-3 w-full">
			<span
				className="bg-foreground/8 absolute inset-y-0 left-0 w-(--size)"
				style={{ '--size': percent(FIGHT_GAP_SECONDS) }}
			/>
			<m.span
				className="bg-foreground/45 absolute inset-y-0.5 left-0"
				initial={false}
				animate={{ width: percent(Math.min(now, later)) }}
				transition={{ duration: 0.4, ease: 'easeOut' }}
			/>
			{later === now ? null : (
				<m.span
					className={cn(
						'absolute inset-y-0.5',
						later < now ? 'bg-foreground/20' : 'border-foreground/30 border border-dashed'
					)}
					initial={false}
					animate={{
						left: percent(Math.min(now, later)),
						width: percent(Math.abs(now - later))
					}}
					transition={{ duration: 0.4, ease: 'easeOut' }}
				/>
			)}
		</span>
	);
}

function FightRow({
	fight,
	scale,
	aidCode,
	lapsLeft,
	active,
	onPick,
	onPoint
}: {
	fight: Fight;
	scale: number;
	aidCode: string;
	lapsLeft: number;
	active: boolean;
	onPick: () => void;
	onPoint: (pointed: boolean) => void;
}) {
	const now = fight.within[0] === 0;
	const why = [paceText(fight), reasonText(fight)].filter(Boolean).join('. ');

	return (
		<m.li layout="position" className="snap-start" transition={{ duration: 0.25, ease: 'easeOut' }}>
			<button
				type="button"
				aria-pressed={active}
				data-testid="fight-row"
				onClick={onPick}
				onPointerEnter={() => onPoint(true)}
				onPointerLeave={() => onPoint(false)}
				onFocus={() => onPoint(true)}
				onBlur={() => onPoint(false)}
				className="hover:bg-accent/70 aria-pressed:bg-accent grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-left @lg:grid-cols-[9.5rem_minmax(0,1fr)_7.5rem]"
			>
				<span className="flex min-w-0 items-center gap-1.5">
					<span className="text-muted-foreground w-5 text-right font-mono text-xs">
						P{fight.ahead.position}
					</span>
					<DriverPortrait driver={fight.ahead.driver} size="xs" />
					<DriverTag driver={fight.ahead.driver} />
					<span aria-hidden className="text-muted-foreground text-xs">
						◂
					</span>
					<DriverPortrait driver={fight.behind.driver} size="xs" mirrored />
					<DriverTag driver={fight.behind.driver} />
				</span>
				<span className="col-span-2 row-start-2 flex min-w-0 items-center gap-2 @lg:col-span-1 @lg:row-start-1">
					<Digits
						value={`${fight.gapSeconds.toFixed(1)}`}
						tick
						className="w-8 shrink-0 text-right text-sm font-bold"
					/>
					<span className="sr-only"> seconds apart.</span>
					<span className="flex min-w-0 flex-1 flex-col gap-0.5">
						<GapBar fight={fight} scale={scale} />
						{why ? (
							<span className="text-muted-foreground text-xs leading-tight">{why}</span>
						) : null}
					</span>
				</span>
				<span className="text-right">
					{now ? (
						<span className="type-label text-foreground font-bold">In {aidCode}</span>
					) : (
						<span className="flex flex-col items-end">
							<span className="type-label">Within 1 s</span>
							<span className="text-sm font-medium">{lapRangeText(fight.within, lapsLeft)}</span>
						</span>
					)}
				</span>
			</button>
		</m.li>
	);
}

function isPair(fight: Fight, pair: Pair | null): boolean {
	return pair?.[0] === fight.ahead.driver.number && pair[1] === fight.behind.driver.number;
}

/**
 * Every fight on track now and every one coming: cars within a second of the one ahead, and cars
 * closing that will be within the next laps, the soonest first. Pointing at a row marks the pair
 * on the map and in the tower; picking one puts it in the duel.
 */
export function FightsTile() {
	const { snapshot, standings } = useRace();
	const { pair, hovered, setPair, setHovered } = usePair();
	const list = React.useMemo(() => fights(snapshot, standings), [snapshot, standings]);

	// A row that leaves the list under the pointer sends no leave event.
	React.useEffect(() => {
		if (hovered && !list.some((fight) => isPair(fight, hovered))) {
			setHovered(null);
		}
	}, [list, hovered, setHovered]);
	const aid = oneSecondAid(snapshot);
	const lapsLeft = snapshot.session.totalLaps - snapshot.currentLap;
	const scale = Math.max(...list.map((fight) => fight.gapSeconds), MIN_SCALE_SECONDS);
	const close = list.filter((fight) => fight.within[0] === 0).length;
	const flag = pausingFlag(snapshot);

	return (
		<Panel aria-label="Fights" data-testid="fights" className="h-full min-h-0">
			<PanelHeader
				title="Fights"
				headline={fightsHeadline(
					list.map((fight) => ({
						ahead: fight.ahead.driver.code,
						behind: fight.behind.driver.code,
						gapSeconds: fight.gapSeconds
					}))
				)}
				meta={list.length === 0 ? undefined : `${close} now, ${list.length - close} coming`}
			/>
			<RaceOnly what="Fights">
				{snapshot.laps.length === 0 ? (
					<EmptyNote />
				) : list.length === 0 ? (
					<EmptyNote>
						{flag
							? `No fights under the ${flag}: they resume at the restart.`
							: 'No car is within a second of the one ahead, or closing on one.'}
					</EmptyNote>
				) : (
					<WholeRows rows="li" className="snap-y snap-mandatory">
						<ol onPointerLeave={() => setHovered(null)}>
							{list.map((fight) => (
								<FightRow
									key={`${fight.ahead.driver.number}-${fight.behind.driver.number}`}
									fight={fight}
									scale={scale}
									aidCode={aid.code}
									lapsLeft={lapsLeft}
									active={isPair(fight, pair)}
									onPick={() => setPair([fight.ahead.driver.number, fight.behind.driver.number])}
									onPoint={(pointed) =>
										setHovered(
											pointed ? [fight.ahead.driver.number, fight.behind.driver.number] : null
										)
									}
								/>
							))}
						</ol>
					</WholeRows>
				)}
			</RaceOnly>
		</Panel>
	);
}
