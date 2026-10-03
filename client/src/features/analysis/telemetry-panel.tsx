import type { Driver, LapTelemetry, TrackOutline } from '@f1-live/shared';
import { PlusIcon, XIcon } from 'lucide-react';
import * as React from 'react';
import {
	CartesianGrid,
	Line,
	LineChart,
	type MouseHandlerDataParam,
	ReferenceDot,
	ReferenceLine,
	Tooltip,
	XAxis,
	YAxis
} from 'recharts';

import { DataTable, TableKey } from '@/components/console/data-table';
import { Digits } from '@/components/console/digits';
import { EmptyNote } from '@/components/console/empty-note';
import { Key, KeyGroup } from '@/components/console/keys';
import { Panel, PanelHeader } from '@/components/console/panel';
import { type ChartConfig, ChartContainer } from '@/components/ui/chart';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useRaceView } from '@/data/race-context';
import { useLapTelemetry, useSessionTelemetry } from '@/data/telemetry-context';
import { sameItems, useStableValue } from '@/hooks/use-stable-value';
import type { SessionTelemetry } from '@/data/telemetry-source';
import {
	type Channel,
	miniSectorSplits,
	type SpeedMinimum,
	speedMinima,
	type TraceRow,
	traceRows
} from '@/insights/telemetry-traces';
import { formatLapTime } from '@/lib/format';
import { cn } from '@/lib/utils';

import { useTileFill } from '../dashboard/tile-fill';

import { useComparedDrivers } from './compare-context';
import {
	defaultSlots,
	type LapChoice,
	lapChoices,
	MAX_SLOTS,
	type TraceMode,
	type TraceSlot
} from './telemetry-selection';

/** Rows every this many metres: finer than the 4 Hz samples at top speed, light enough to hover. */
const STEP_M = 10;

const MODES = [
	{ value: 'drivers', label: 'Drivers' },
	{ value: 'laps', label: 'Laps' }
] as const satisfies readonly { value: TraceMode; label: string }[];

/** Each slot keeps its own line pattern, so laps of one driver, in one colour, stay apart. */
const SLOT_DASH = [undefined, '6 3', '2 2'] as const;

const SLOT_LETTER = ['A', 'B', 'C'] as const;

const SLOT_SWATCH = [
	'border-team w-5 border-t-2',
	'border-team w-5 border-t-2 border-dashed',
	'border-team w-5 border-t-2 border-dotted'
] as const;

type SlotLine = {
	key: string;
	letter: string;
	driver: Driver;
	lap: LapTelemetry;
	/** The official time, which the telemetry's own crossing times can miss by a few hundredths. */
	lapTimeMs: number;
};

type HoverStore = {
	get: () => number | null;
	set: (index: number | null) => void;
	subscribe: (listener: () => void) => () => void;
};

/** The distance row under the pointer, shared by every chart and the readout without re-rendering them. */
function createHoverStore(): HoverStore {
	let index: number | null = null;
	const listeners = new Set<() => void>();

	return {
		get: () => index,
		set: (next) => {
			if (next !== index) {
				index = next;

				for (const listener of listeners) {
					listener();
				}
			}
		},
		subscribe: (listener) => {
			listeners.add(listener);

			return () => listeners.delete(listener);
		}
	};
}

type ChannelSpec = {
	channel: Channel | 'delta';
	label: string;
	format: (value: number) => string;
	stepped?: boolean;
	domain?: [number, number];
	/** Share of the height when the tile has a fixed height; class height otherwise. */
	grow: string;
	height: string;
};

const CHANNEL_SPECS: readonly ChannelSpec[] = [
	{
		channel: 'speed',
		label: 'Speed km/h',
		format: (value) => value.toFixed(0),
		grow: 'flex-4',
		height: 'h-44'
	},
	{
		channel: 'delta',
		label: 'Delta to A, s',
		format: (value) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}`,
		grow: 'flex-2',
		height: 'h-24'
	},
	{
		channel: 'throttle',
		label: 'Throttle %',
		format: (value) => value.toFixed(0),
		domain: [0, 100],
		grow: 'flex-2',
		height: 'h-20'
	},
	{
		channel: 'brake',
		label: 'Brake',
		format: (value) => (value > 0 ? 'On' : 'Off'),
		stepped: true,
		domain: [0, 1],
		grow: 'flex-1',
		height: 'h-12'
	},
	{
		channel: 'gear',
		label: 'Gear',
		format: (value) => value.toFixed(0),
		stepped: true,
		domain: [0, 8],
		grow: 'flex-2',
		height: 'h-20'
	},
	{
		channel: 'rpm',
		label: 'RPM',
		format: (value) => `${(value / 1000).toFixed(1)}k`,
		grow: 'flex-2',
		height: 'h-20'
	}
];

function kilometreTicks(lengthM: number): number[] {
	return Array.from({ length: Math.floor(lengthM / 1000) + 1 }, (_, index) => index * 1000);
}

/** One channel of the traces against distance; every channel shares the pointer. */
const ChannelChart = React.memo(function ChannelChart({
	spec,
	rows,
	lines,
	circuit,
	minima,
	syncId,
	hover,
	showAxis,
	fill
}: {
	spec: ChannelSpec;
	rows: readonly TraceRow[];
	lines: readonly SlotLine[];
	circuit: TrackOutline;
	minima: readonly SpeedMinimum[];
	syncId: string;
	hover: HoverStore;
	showAxis: boolean;
	fill: boolean;
}) {
	const keys = lines.flatMap((line, slot) =>
		spec.channel === 'delta' && slot === 0 ? [] : [{ line, slot, key: `${spec.channel}${slot}` }]
	);

	const config: ChartConfig = Object.fromEntries(
		lines.map((line) => [line.key, { label: line.letter, color: `#${line.driver.teamColour}` }])
	);

	const onMove = (state: MouseHandlerDataParam) => {
		const index = Number(state.activeTooltipIndex);

		hover.set(Number.isInteger(index) ? index : null);
	};

	const end = rows.at(-1)?.d ?? circuit.lengthM;

	return (
		<div className={cn('flex min-h-0 flex-col', fill ? cn(spec.grow, 'min-h-12') : spec.height)}>
			<span className="type-label">{spec.label}</span>
			<ChartContainer config={config} className="aspect-auto min-h-0 w-full flex-1">
				<LineChart
					data={rows}
					syncId={syncId}
					margin={{ left: 0, right: 8, top: 2, bottom: 0 }}
					onMouseMove={onMove}
					onMouseLeave={() => hover.set(null)}
				>
					<CartesianGrid vertical={false} />
					<XAxis
						dataKey="d"
						type="number"
						domain={[0, end]}
						ticks={kilometreTicks(end)}
						tickFormatter={(distance: number) => `${distance / 1000} km`}
						tickLine={false}
						axisLine={false}
						hide={!showAxis}
					/>
					<YAxis
						width={40}
						tickLine={false}
						axisLine={false}
						domain={spec.domain ?? ['auto', 'auto']}
						allowDecimals={spec.channel === 'delta'}
						tickCount={spec.channel === 'brake' ? 2 : 4}
						tickFormatter={spec.format}
					/>
					{circuit.sectorBoundariesM.map((distance, index) => (
						<ReferenceLine
							key={distance}
							x={distance}
							stroke="var(--rule-strong)"
							strokeOpacity={0.6}
							label={
								spec.channel === 'speed'
									? {
											value: `S${index + 2}`,
											position: 'insideTopLeft',
											className: 'fill-muted-foreground text-[10px]'
										}
									: undefined
							}
						/>
					))}
					{spec.channel === 'speed'
						? circuit.miniSectorStartsM.map((distance) => (
								<ReferenceLine key={distance} x={distance} stroke="var(--border)" />
							))
						: null}
					{spec.channel === 'delta' ? <ReferenceLine y={0} stroke="var(--rule-strong)" /> : null}
					{spec.channel === 'speed'
						? minima.map((corner) => (
								<ReferenceDot
									key={corner.distanceM}
									x={corner.distanceM}
									y={corner.speedKph}
									r={0}
									label={{
										value: corner.speedKph,
										position: 'bottom',
										// Narrow tiles have no room for every corner's number.
										className: 'fill-muted-foreground hidden text-[10px] @xl:inline'
									}}
								/>
							))
						: null}
					<Tooltip
						content={() => null}
						cursor={{ stroke: 'var(--foreground)', strokeOpacity: 0.35 }}
						isAnimationActive={false}
					/>
					{keys.map(({ line, slot, key }) => (
						<Line
							key={key}
							dataKey={key}
							type={spec.stepped ? 'stepAfter' : 'linear'}
							stroke={`var(--color-${line.key})`}
							strokeWidth={1.5}
							strokeDasharray={SLOT_DASH[slot]}
							dot={false}
							activeDot={false}
							connectNulls
							isAnimationActive={false}
						/>
					))}
				</LineChart>
			</ChartContainer>
		</div>
	);
});

/** Values under the pointer, or each lap's summary when nothing is hovered: the charts' legend. */
function Readout({
	rows,
	lines,
	hover
}: {
	rows: readonly TraceRow[];
	lines: readonly SlotLine[];
	hover: HoverStore;
}) {
	const index = React.useSyncExternalStore(hover.subscribe, hover.get);
	const row = index === null ? null : rows[index];

	return (
		<div className="flex flex-col gap-1" aria-live="off" data-testid="telemetry-readout">
			<span className="type-label">
				{row ? `${Math.round(row.d)} m from the line` : 'Laps compared'}
			</span>
			<ul className="flex flex-col">
				{lines.map((line, slot) => {
					const value = (channel: string) => row?.[`${channel}${slot}`] ?? null;

					// Under the pointer, the gap at that distance; otherwise the gap in official lap time.
					const delta =
						slot === 0
							? null
							: row
								? row[`delta${slot}`]
								: (line.lapTimeMs - (lines[0]?.lapTimeMs ?? line.lapTimeMs)) / 1000;

					return (
						<li
							key={line.key}
							className="grid grid-cols-[1.25rem_1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b py-1 text-sm last:border-b-0 @xl:grid-cols-[1.25rem_1.5rem_minmax(10rem,auto)_repeat(5,minmax(0,1fr))_5rem]"
							style={{ '--team': `#${line.driver.teamColour}` }}
						>
							<span className="type-label">{line.letter}</span>
							<span aria-hidden className={SLOT_SWATCH[slot]} />
							<span className="flex min-w-0 items-baseline gap-2">
								<span className="type-wide font-bold">{line.driver.code}</span>
								<span className="text-muted-foreground font-mono text-xs whitespace-nowrap">
									L{line.lap.lap} {formatLapTime(line.lapTimeMs)}
								</span>
							</span>
							{row ? (
								<>
									<Digits
										className="hidden text-right @xl:inline"
										value={`${value('speed') ?? '–'}`}
									/>
									<Digits
										className="hidden text-right @xl:inline"
										value={`${Math.round(value('throttle') ?? 0)}%`}
									/>
									<span className="type-label hidden text-right @xl:inline">
										{value('brake') ? 'Brake' : '–'}
									</span>
									<span className="hidden text-right font-mono @xl:inline">
										G{value('gear') ?? '–'}
									</span>
									<Digits
										className="hidden text-right @xl:inline"
										value={`${Math.round(value('rpm') ?? 0)}`}
									/>
								</>
							) : (
								<span className="text-muted-foreground hidden text-xs @xl:col-span-5 @xl:inline">
									Top {Math.max(...(line.lap.speed ?? [0]))} km/h
								</span>
							)}
							<Digits
								className="text-right"
								value={
									delta === null || delta === undefined
										? slot === 0
											? 'ref'
											: '–'
										: `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(3)}`
								}
							/>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

function SlotPicker({
	slot,
	index,
	mode,
	drivers,
	choicesOf,
	onChange,
	onRemove
}: {
	slot: TraceSlot;
	index: number;
	mode: TraceMode;
	drivers: readonly Driver[];
	choicesOf: (driverNumber: string) => readonly LapChoice[];
	onChange: (slot: TraceSlot) => void;
	onRemove?: () => void;
}) {
	const driver = drivers.find((entry) => entry.number === slot.driverNumber);
	const choices = choicesOf(slot.driverNumber);

	return (
		<div
			className="flex min-w-0 flex-wrap items-center gap-2 border-l-2 pl-2"
			style={driver ? { '--team': `#${driver.teamColour}` } : undefined}
			data-testid={`telemetry-slot-${SLOT_LETTER[index] ?? index}`}
		>
			<span className="type-label">{SLOT_LETTER[index]}</span>
			<span aria-hidden className={SLOT_SWATCH[index]} />
			{mode === 'drivers' ? (
				<Select
					value={slot.driverNumber}
					onValueChange={(driverNumber) => {
						const best = choicesOf(driverNumber).find((choice) => choice.fastest);

						if (best) {
							onChange({ driverNumber, lap: best.lap.lap });
						}
					}}
				>
					<SelectTrigger size="sm" aria-label={`Driver ${SLOT_LETTER[index]}`}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{drivers.map((entry) => (
							<SelectItem key={entry.number} value={entry.number}>
								{entry.code}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			) : null}
			<Select
				value={String(slot.lap)}
				onValueChange={(lap) => onChange({ ...slot, lap: Number(lap) })}
			>
				<SelectTrigger size="sm" aria-label={`Lap ${SLOT_LETTER[index]}`}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{choices.map((choice) => (
						<SelectItem key={choice.lap.lap} value={String(choice.lap.lap)}>
							L{choice.lap.lap} {formatLapTime(choice.lap.lapTimeMs)}
							{choice.fastest ? ' best' : ''}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{onRemove ? (
				<Key aria-label={`Remove lap ${SLOT_LETTER[index]}`} onClick={onRemove}>
					<XIcon aria-hidden />
				</Key>
			) : null}
		</div>
	);
}

function TelemetryBody({
	session,
	mode,
	table
}: {
	session: SessionTelemetry;
	mode: TraceMode;
	table: boolean;
}) {
	const { snapshot, followedDriver, sessionKey, sourceKind } = useRaceView();
	const { compared } = useComparedDrivers();
	const fill = useTileFill();
	const syncId = React.useId();
	const [hover] = React.useState(createHoverStore);
	const { index, circuit } = session;

	// Picks belong to the session and mode they were made in.
	const [picked, setPicked] = React.useState<{
		key: string;
		mode: TraceMode;
		slots: TraceSlot[];
	} | null>(null);

	const choices = React.useMemo(() => {
		const byDriver = new Map<string, LapChoice[]>();

		for (const driver of snapshot.drivers) {
			byDriver.set(driver.number, lapChoices(snapshot, index.laps, driver.number, circuit.lengthM));
		}

		return byDriver;
	}, [snapshot, index, circuit]);

	const choicesOf = React.useCallback(
		(driverNumber: string) => choices.get(driverNumber) ?? [],
		[choices]
	);

	const available = (slot: TraceSlot) =>
		choicesOf(slot.driverNumber).some((choice) => choice.lap.lap === slot.lap);

	const ownPicks =
		picked?.key === sessionKey && picked.mode === mode ? picked.slots.filter(available) : [];

	const slots =
		ownPicks.length > 0 ? ownPicks : defaultSlots(mode, compared, followedDriver, choicesOf);

	const drivers = snapshot.drivers.filter((driver) => choicesOf(driver.number).length > 0);

	const chosen = slots.flatMap(
		(slot) => choicesOf(slot.driverNumber).find((choice) => choice.lap.lap === slot.lap) ?? []
	);

	const entries = chosen.map((choice) => choice.entry);

	const loaded = useLapTelemetry(entries);
	const laps = entries.map((entry) => loaded.get(entry.file));
	const failed = laps.find((lap) => lap instanceof Error);
	const ready = laps.every((lap) => lap !== undefined && !(lap instanceof Error));

	// Loaded laps keep their identity, so scrubbing the replay redraws nothing here.
	const lapTelemetry = useStableValue(
		ready ? laps.flatMap((lap) => (lap === undefined || lap instanceof Error ? [] : [lap])) : [],
		sameItems
	);

	const traced = React.useMemo(
		() => ({
			rows: traceRows(lapTelemetry, STEP_M),
			splits: lapTelemetry.length > 0 ? miniSectorSplits(lapTelemetry, circuit) : [],
			minima: lapTelemetry[0] ? speedMinima(lapTelemetry[0]) : []
		}),
		[lapTelemetry, circuit]
	);

	// The official times, kept while they stay the same, so the charts below redraw only for new laps.
	const officialTimes = useStableValue(
		chosen.map((choice) => choice.lap.lapTimeMs),
		sameItems
	);

	const lines = React.useMemo(
		() =>
			lapTelemetry.flatMap((lap, slot): SlotLine[] => {
				const driver = snapshot.drivers.find((entry) => entry.number === lap.driverNumber);

				return driver
					? [
							{
								key: `s${slot}`,
								letter: SLOT_LETTER[slot] ?? '',
								driver,
								lap,
								// The modelled replay's own times are not these laps'.
								lapTimeMs:
									sourceKind === 'mock' ? lap.lapTimeMs : (officialTimes[slot] ?? lap.lapTimeMs)
							}
						]
					: [];
			}),
		[lapTelemetry, snapshot.drivers, sourceKind, officialTimes]
	);

	const setSlots = (next: TraceSlot[]) => setPicked({ key: sessionKey, mode, slots: next });

	const addSlot = () => {
		const driverNumber = mode === 'laps' ? slots[0]?.driverNumber : undefined;
		const used = new Set(slots.map((slot) => `${slot.driverNumber}/${slot.lap}`));

		const candidates =
			driverNumber === undefined
				? drivers.filter((driver) => !slots.some((slot) => slot.driverNumber === driver.number))
				: drivers.filter((driver) => driver.number === driverNumber);

		for (const driver of candidates) {
			const choice = choicesOf(driver.number)
				.toSorted((a, b) => a.lap.lapTimeMs - b.lap.lapTimeMs)
				.find((entry) => !used.has(`${driver.number}/${entry.lap.lap}`));

			if (choice) {
				setSlots([...slots, { driverNumber: driver.number, lap: choice.lap.lap }]);

				return;
			}
		}
	};

	if (slots.length === 0) {
		return (
			<EmptyNote className="px-0">
				No lap has run line to line with telemetry by this point of the session.
			</EmptyNote>
		);
	}

	const specs = index.hasCarData
		? CHANNEL_SPECS
		: CHANNEL_SPECS.filter((spec) => spec.channel === 'delta');

	return (
		<>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
				{mode === 'laps' && slots[0] ? (
					<Select
						value={slots[0].driverNumber}
						onValueChange={(driverNumber) =>
							setSlots(defaultSlots('laps', [], driverNumber, choicesOf))
						}
					>
						<SelectTrigger size="sm" aria-label="Driver">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{drivers.map((entry) => (
								<SelectItem key={entry.number} value={entry.number}>
									{entry.code}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : null}
				{slots.map((slot, slotIndex) => (
					<SlotPicker
						key={SLOT_LETTER[slotIndex]}
						slot={slot}
						index={slotIndex}
						mode={mode}
						drivers={drivers}
						choicesOf={choicesOf}
						onChange={(next) => setSlots(slots.with(slotIndex, next))}
						onRemove={
							slotIndex === 0
								? undefined
								: () => setSlots(slots.filter((_, at) => at !== slotIndex))
						}
					/>
				))}
				{slots.length < MAX_SLOTS ? (
					<Key onClick={addSlot}>
						<PlusIcon aria-hidden />
						Add lap
					</Key>
				) : null}
			</div>
			{failed instanceof Error ? (
				<p role="alert" className="text-danger text-sm">
					A lap’s telemetry could not be loaded: {failed.message}
				</p>
			) : !ready ? (
				<div className={cn('flex flex-col gap-2', fill && 'flex-1')} aria-busy>
					<Skeleton className="h-40 w-full" />
					<Skeleton className="h-24 w-full" />
				</div>
			) : table ? (
				<DataTable
					caption="Time through each mini sector, against lap A"
					className={cn(fill && 'flex-1')}
					columns={[
						{ key: 'mini', label: 'Mini sector' },
						...lines.flatMap((line, slot) => [
							{
								key: `time${slot}`,
								label: `${line.letter} ${line.driver.code} L${line.lap.lap}`,
								numeric: true
							},
							...(slot === 0
								? []
								: [{ key: `delta${slot}`, label: `${line.letter} to A`, numeric: true }]),
							{ key: `min${slot}`, label: `${line.letter} slowest`, numeric: true }
						])
					]}
					rows={traced.splits.map((split) => ({
						id: String(split.index),
						mini: `M${split.index + 1} S${split.sector + 1}`,
						...Object.fromEntries(
							lines.flatMap((_, slot) => {
								const time = split.timesMs[slot] ?? 0;
								const reference = split.timesMs[0] ?? 0;
								const speed = split.minSpeedKph[slot];

								return [
									[`time${slot}`, (time / 1000).toFixed(3)],
									[
										`delta${slot}`,
										`${time - reference >= 0 ? '+' : '−'}${(Math.abs(time - reference) / 1000).toFixed(3)}`
									],
									[`min${slot}`, speed === null || speed === undefined ? null : `${speed}`]
								];
							})
						)
					}))}
				/>
			) : (
				<>
					<div
						className={cn('flex flex-col gap-1', fill && 'min-h-0 flex-1')}
						data-testid="telemetry-charts"
					>
						{specs.map((spec, specIndex) => (
							<ChannelChart
								key={spec.channel}
								spec={spec}
								rows={traced.rows}
								lines={lines}
								circuit={circuit}
								minima={traced.minima}
								syncId={syncId}
								hover={hover}
								showAxis={specIndex === specs.length - 1}
								fill={fill}
							/>
						))}
					</div>
					<Readout rows={traced.rows} lines={lines} hover={hover} />
				</>
			)}
			<p className="text-muted-foreground text-xs">
				{sourceKind === 'mock'
					? 'The replay’s lap times are modelled; these traces are the real race’s laps, so only a few laps have them. '
					: ''}
				{index.hasCarData ? '' : 'This session has positions only, so only the delta is drawn. '}
				Distance from the line; rules mark the mini sectors of the timing feed, heavier at the
				sector ends. Numbers under the speed trace are each corner’s slowest point on lap A. The
				delta is time behind lap A at the same distance.
			</p>
		</>
	);
}

/** Why there is nothing to trace, in the viewer's terms. */
function unavailableNote(isLive: boolean): string {
	return isLive
		? 'Telemetry for a live session arrives from the archive once it ends.'
		: 'This session was saved without telemetry.';
}

/**
 * Speed, throttle, brake, gear and revs against distance for up to three laps, with the time
 * each lap gains or loses on the first at every metre. Drivers compares the compared drivers on
 * their best laps; Laps compares one driver's laps. The table gives the time through each mini
 * sector.
 */
export function TelemetryPanel() {
	const { live } = useRaceView();
	const telemetry = useSessionTelemetry();
	const fill = useTileFill();
	const [mode, setMode] = React.useState<TraceMode>('drivers');
	const [table, setTable] = React.useState(false);

	return (
		<Panel
			aria-label="Telemetry"
			className={cn('min-h-0', fill && 'h-full')}
			data-testid="telemetry"
		>
			<PanelHeader title="Telemetry" meta={mode === 'drivers' ? 'Best laps' : 'One driver'}>
				<KeyGroup label="Compare" options={MODES} value={mode} onChange={setMode} />
				<TableKey table={table} onTableChange={setTable} />
			</PanelHeader>
			<div className={cn('flex flex-col gap-3 p-4', fill && 'min-h-0 flex-1')}>
				{telemetry.status === 'ready' ? (
					<TelemetryBody session={telemetry.value} mode={mode} table={table} />
				) : telemetry.status === 'loading' ? (
					<div className="flex flex-col gap-2" aria-busy>
						<Skeleton className="h-3 w-1/2" />
						<Skeleton className="h-40 w-full" />
					</div>
				) : telemetry.status === 'error' ? (
					<p role="alert" className="text-danger text-sm">
						Telemetry could not be loaded: {telemetry.message}
					</p>
				) : (
					<p className="text-muted-foreground text-sm" data-testid="telemetry-unavailable">
						{unavailableNote(live.isLive)}
					</p>
				)}
			</div>
		</Panel>
	);
}
