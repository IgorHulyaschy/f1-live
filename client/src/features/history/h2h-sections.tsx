import { dnfLabel, type ResultRow } from '@f1-live/shared/results';
import * as React from 'react';
import { Link } from 'react-router';

import { KeyGroup } from '@/components/console/keys';
import { Panel, PanelHeader } from '@/components/console/panel';
import { CarSide, DriverPortrait } from '@/components/driver-media';
import { SESSION_PATH } from '@/features/dashboard/paths';
import { type Evidence, eventLabel, type Fact } from '@/insights/h2h-facts';
import {
	breakdowns,
	type H2HEvent,
	type H2HTotals,
	type Meeting,
	rollingGap,
	type Side,
	winnerOf
} from '@/insights/head-to-head';
import { hasTeamPictures } from '@/lib/media';
import { cn } from '@/lib/utils';

import type { Contender } from './h2h-picker';

type Pair = { a: Contender; b: Contender };

/** The session's address, with the driver view open where the fact is about one driver. */
export function sessionLink(key: number, carNumber?: string, vs?: string): string {
	const params = new URLSearchParams({ session: String(key) });

	if (carNumber) {
		params.set('car', carNumber);
	}

	if (vs) {
		params.set('vs', vs);
	}

	return `${SESSION_PATH}?${params}`;
}

function number(value: number | null, digits = 0): string {
	if (value === null) {
		return '–';
	}

	return Number.isInteger(value) && digits === 0 ? String(value) : value.toFixed(digits || 1);
}

/** Two values and the share of their sum each holds, as a split bar under them. */
function Split({ a, b, pair }: { a: number; b: number; pair: Pair }) {
	const total = a + b;
	const share = total === 0 ? 50 : (a / total) * 100;
	const sameTeam = pair.a.colour === pair.b.colour;

	return (
		<span aria-hidden className="col-span-3 flex h-2 gap-px">
			<span
				className="bg-team h-full w-(--size)"
				style={{ '--team': `#${pair.a.colour}`, '--size': `${share}%` }}
			/>
			<span
				className={cn('bg-team h-full flex-1', sameTeam && 'hatch bg-transparent')}
				style={{ '--team': `#${pair.b.colour}` }}
			/>
		</span>
	);
}

function Row({
	label,
	a,
	b,
	note,
	pair,
	split = true,
	better = 'more'
}: {
	label: string;
	a: string;
	b: string;
	note?: string;
	pair: Pair;
	split?: boolean | { a: number; b: number };
	/** Which way is better, to set the leading value in bold; none for neutral rows. */
	better?: 'more' | 'less' | 'none';
}) {
	const valueA = Number.parseFloat(a);
	const valueB = Number.parseFloat(b);

	const comparable =
		better !== 'none' && Number.isFinite(valueA) && Number.isFinite(valueB) && valueA !== valueB;

	const aLeads = comparable && (better === 'more' ? valueA > valueB : valueA < valueB);
	const bLeads = comparable && !aLeads;
	const bar = split === true ? { a: valueA, b: valueB } : split;

	return (
		<li
			className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-x-3 gap-y-1 border-b py-2"
			data-testid="h2h-row"
		>
			<span className={cn('font-mono text-lg', aLeads ? 'font-bold' : 'text-muted-foreground')}>
				{a}
			</span>
			<span className="type-label text-center">
				{label}
				{note ? <span className="text-muted-foreground block normal-case">{note}</span> : null}
			</span>
			<span
				className={cn(
					'text-right font-mono text-lg',
					bLeads ? 'font-bold' : 'text-muted-foreground'
				)}
			>
				{b}
			</span>
			{bar && Number.isFinite(bar.a) && Number.isFinite(bar.b) ? (
				<Split a={bar.a} b={bar.b} pair={pair} />
			) : null}
		</li>
	);
}

function seconds(ms: number | null): string {
	return ms === null ? '–' : `${ms < 0 ? '−' : '+'}${(Math.abs(ms) / 1000).toFixed(3)}`;
}

/** A side's picture: a driver's portrait, or a team line's car, turned to face the other side. */
function Contestant({ contender, mirrored = false }: { contender: Contender; mirrored?: boolean }) {
	const { picture } = contender;

	if ('face' in picture) {
		return <DriverPortrait driver={picture.face} size="lg" tinted mirrored={mirrored} />;
	}

	return hasTeamPictures(picture.team) ? (
		<CarSide subject={picture.team} size="sm" className={mirrored ? '-scale-x-100' : undefined} />
	) : null;
}

/** The totals, headline numbers first and the deeper ones after, readable on a 360 px phone. */
export function Scoreboard({
	totals,
	pair,
	sides
}: {
	totals: H2HTotals;
	pair: Pair;
	sides: { a: Side };
}) {
	const { a, b } = totals;
	const teammates = totals.gaps.length > 0;

	return (
		<Panel>
			<PanelHeader
				title="Totals"
				meta={`${totals.events} weekends, ${totals.racesTogether} races together`}
			/>
			<div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 px-4 pt-3">
				<div className="flex min-w-0 flex-col items-start gap-2">
					<Contestant contender={pair.a} />
					<span
						className="type-wide text-sm leading-tight font-black wrap-anywhere italic"
						data-testid="h2h-name-a"
					>
						{pair.a.label}
					</span>
				</div>
				<span className="type-label">vs</span>
				<div className="flex min-w-0 flex-col items-end gap-2">
					<Contestant contender={pair.b} mirrored />
					<span
						className="type-wide text-right text-sm leading-tight font-black wrap-anywhere italic"
						data-testid="h2h-name-b"
					>
						{pair.b.label}
					</span>
				</div>
			</div>
			<ul className="px-4" data-testid="h2h-totals">
				<Row
					pair={pair}
					label="Races"
					a={String(totals.racesTogether)}
					b={String(totals.racesTogether)}
					split={false}
					better="none"
				/>
				<Row
					pair={pair}
					label="Qualifying"
					note="higher grid slot"
					a={String(totals.qualifying.a)}
					b={String(totals.qualifying.b)}
				/>
				<Row
					pair={pair}
					label="Race"
					note="better finish, one classified"
					a={String(totals.race.a)}
					b={String(totals.race.b)}
				/>
				{totals.sprint.a + totals.sprint.b > 0 ? (
					<Row pair={pair} label="Sprint" a={String(totals.sprint.a)} b={String(totals.sprint.b)} />
				) : null}
				<Row pair={pair} label="Wins" a={String(a.wins)} b={String(b.wins)} />
				<Row pair={pair} label="Podiums" a={String(a.podiums)} b={String(b.podiums)} />
				<Row pair={pair} label="Poles" a={String(a.poles)} b={String(b.poles)} />
				<Row
					pair={pair}
					label="DNFs"
					note="retired before 90%"
					a={String(a.dnfs)}
					b={String(b.dnfs)}
					better="less"
					split={false}
				/>
				<Row pair={pair} label="Points" a={number(a.points)} b={number(b.points)} />
			</ul>
			<h3 className="type-label border-rule-strong mx-4 mt-2 border-b-2 pb-1">Deeper</h3>
			<ul className="px-4 pb-2" data-testid="h2h-deeper">
				{totals.sprintQualifying.a + totals.sprintQualifying.b > 0 ? (
					<Row
						pair={pair}
						label="Sprint qualifying"
						a={String(totals.sprintQualifying.a)}
						b={String(totals.sprintQualifying.b)}
					/>
				) : null}
				<Row pair={pair} label="Q3 appearances" a={String(a.q3)} b={String(b.q3)} />
				{teammates ? (
					<>
						<Row
							pair={pair}
							label="Qualifying gap"
							note={`average, ${totals.gaps.length} sessions`}
							a={seconds(totals.averageGapMs)}
							b={seconds(totals.averageGapMs === null ? null : -totals.averageGapMs)}
							better="less"
							split={false}
						/>
						<Row
							pair={pair}
							label="Median gap"
							note={`${number(totals.averageGapPct === null ? null : Math.abs(totals.averageGapPct), 3)}% on average`}
							a={seconds(totals.medianGapMs)}
							b={seconds(totals.medianGapMs === null ? null : -totals.medianGapMs)}
							better="less"
							split={false}
						/>
					</>
				) : null}
				<Row
					pair={pair}
					label="Average grid"
					a={number(a.averageGrid, 1)}
					b={number(b.averageGrid, 1)}
					better="less"
					split={false}
				/>
				<Row
					pair={pair}
					label="Average finish"
					a={number(a.averageFinish, 1)}
					b={number(b.averageFinish, 1)}
					better="less"
					split={false}
				/>
				<Row
					pair={pair}
					label="Places gained"
					note="grid to flag"
					a={`${a.positionsGained > 0 ? '+' : ''}${a.positionsGained}`}
					b={`${b.positionsGained > 0 ? '+' : ''}${b.positionsGained}`}
					split={false}
				/>
				<Row pair={pair} label="Laps led" a={String(a.lapsLed)} b={String(b.lapsLed)} />
				<Row pair={pair} label="Fastest laps" a={String(a.fastestLaps)} b={String(b.fastestLaps)} />
				<Row
					pair={pair}
					label="Points per race"
					a={number(a.pointsPerRace, 1)}
					b={number(b.pointsPerRace, 1)}
					split={false}
				/>
				<Row
					pair={pair}
					label="Best result"
					a={a.bestFinish ? `P${a.bestFinish.position} ×${a.bestFinish.times}` : '–'}
					b={b.bestFinish ? `P${b.bestFinish.position} ×${b.bestFinish.times}` : '–'}
					better="none"
					split={false}
				/>
			</ul>
			{sides.a.kind === 'team' ? (
				<p className="text-muted-foreground px-4 pb-3 text-xs">
					Teams are compared by their better-placed car; wins, podiums, DNFs and points count every
					car.
				</p>
			) : null}
		</Panel>
	);
}

function EvidenceLink({ item, children }: { item: Evidence; children?: React.ReactNode }) {
	return (
		<Link
			to={sessionLink(item.session.key, item.carNumber)}
			className="type-label hover:text-foreground underline-offset-2 hover:underline"
		>
			{children ?? item.label}
		</Link>
	);
}

/** The facts, most interesting first, each linking to the sessions it rests on. */
export function Facts({ facts }: { facts: readonly Fact[] }) {
	return (
		<Panel>
			<PanelHeader title="Facts" meta={facts.length === 0 ? 'None yet' : `${facts.length} found`} />
			<ol className="px-4" data-testid="h2h-facts">
				{facts.map((fact) => (
					<li
						key={fact.id}
						className="flex flex-col gap-1 border-b py-2.5 last:border-b-0"
						data-testid="h2h-fact"
					>
						<span className="text-sm">{fact.text}</span>
						<span className="flex flex-wrap gap-x-3">
							{fact.evidence.map((item) => (
								<EvidenceLink key={`${fact.id}-${item.session.key}`} item={item} />
							))}
						</span>
					</li>
				))}
			</ol>
		</Panel>
	);
}

/** Each shared qualifying's gap as a bar, with the rolling average over five as a line. */
export function GapTrend({ totals, pair }: { totals: H2HTotals; pair: Pair }) {
	const points = rollingGap(totals.gaps);
	const limit = Math.max(0.2, ...points.map((point) => Math.min(Math.abs(point.gap.pct), 2)));
	const width = 600;
	const height = 160;
	const step = width / Math.max(points.length, 1);

	const y = (pct: number) =>
		height / 2 + (Math.max(-limit, Math.min(limit, pct)) / limit) * (height / 2 - 6);

	if (points.length < 2) {
		return null;
	}

	return (
		<Panel>
			<PanelHeader title="Qualifying gap" meta="each session, and the average of the last five" />
			<figure className="px-4 py-3">
				<figcaption className="sr-only">
					{`Qualifying gap over ${points.length} sessions; below the line ${pair.a.label} was quicker`}
				</figcaption>
				<svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" aria-hidden>
					<line
						x1={0}
						x2={width}
						y1={height / 2}
						y2={height / 2}
						className="stroke-border"
						strokeWidth={1}
					/>
					{points.map((point, index) => (
						<rect
							key={point.gap.event.round.meetingKey}
							x={index * step + step * 0.15}
							width={step * 0.7}
							y={Math.min(height / 2, y(point.gap.pct))}
							height={Math.abs(y(point.gap.pct) - height / 2)}
							className="fill-team"
							style={{ '--team': `#${point.gap.pct < 0 ? pair.a.colour : pair.b.colour}` }}
							opacity={0.55}
						>
							<title>
								{eventLabel(point.gap.event)}: {point.gap.pct < 0 ? pair.a.label : pair.b.label} by{' '}
								{(Math.abs(point.gap.ms) / 1000).toFixed(3)} s
							</title>
						</rect>
					))}
					<polyline
						fill="none"
						className="stroke-foreground"
						strokeWidth={2}
						points={points
							.map((point, index) => `${index * step + step / 2},${y(point.rollingPct)}`)
							.join(' ')}
					/>
				</svg>
				<figcaption className="type-label flex justify-between">
					<span>▲ {pair.b.label} quicker</span>
					<span>▼ {pair.a.label} quicker</span>
				</figcaption>
			</figure>
		</Panel>
	);
}

/** Season by season, or circuit by circuit. */
export function Breakdown({
	events,
	sides,
	pair
}: {
	events: readonly H2HEvent[];
	sides: { a: Side; b: Side };
	pair: Pair;
}) {
	const [by, setBy] = React.useState<'season' | 'circuit'>('season');
	const groups = breakdowns(events, sides, by);

	return (
		<Panel>
			<PanelHeader title="Breakdown">
				<KeyGroup
					label="Break down by"
					options={[
						{ value: 'season', label: 'Season' },
						{ value: 'circuit', label: 'Circuit' }
					]}
					value={by}
					onChange={setBy}
				/>
			</PanelHeader>
			<div className="max-h-120 overflow-auto px-4">
				<table className="w-full text-sm" data-testid="h2h-breakdown">
					<caption className="sr-only">
						{pair.a.label} against {pair.b.label} by {by}
					</caption>
					<thead className="bg-panel sticky top-0">
						<tr className="border-b">
							<th scope="col" className="type-label py-1.5 text-left font-normal">
								{by === 'season' ? 'Season' : 'Circuit'}
							</th>
							<th scope="col" className="type-label px-2 text-right font-normal">
								Quali
							</th>
							<th scope="col" className="type-label px-2 text-right font-normal">
								Race
							</th>
							<th scope="col" className="type-label px-2 text-right font-normal">
								Wins
							</th>
							<th scope="col" className="type-label pl-2 text-right font-normal">
								Points
							</th>
						</tr>
					</thead>
					<tbody>
						{groups.map((group) => (
							<tr key={group.id} className="h-8 border-b last:border-b-0">
								<td className="truncate">{group.label}</td>
								<td className="px-2 text-right font-mono">
									{group.totals.qualifying.a}–{group.totals.qualifying.b}
								</td>
								<td className="px-2 text-right font-mono">
									{group.totals.race.a}–{group.totals.race.b}
								</td>
								<td className="px-2 text-right font-mono">
									{group.totals.a.wins}–{group.totals.b.wins}
								</td>
								<td className="pl-2 text-right font-mono">
									{number(group.totals.a.points)}–{number(group.totals.b.points)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</Panel>
	);
}

function place(row: ResultRow | undefined): string {
	if (!row) {
		return '–';
	}

	if (row.status === 'dsq') {
		return 'DSQ';
	}

	if (row.status === 'dns') {
		return 'DNS';
	}

	return row.classified ? `P${row.position}` : row.status === 'nc' ? 'NC' : dnfLabel(row);
}

function Cell({
	meeting,
	side,
	other
}: {
	meeting: Meeting | null;
	side: 'a' | 'b';
	other: 'a' | 'b';
}) {
	if (!meeting) {
		return <td className="text-muted-foreground px-2 text-right font-mono">–</td>;
	}

	const row = meeting[side][0];
	const won = winnerOf(meeting) === side;

	return (
		<td className={cn('px-2 text-right font-mono', won ? 'font-bold' : 'text-muted-foreground')}>
			<Link
				to={sessionLink(meeting.session.key, row?.number, meeting[other][0]?.number)}
				className="hover:underline"
				aria-label={`${meeting.session.name}: ${place(row)}, compare`}
			>
				{place(row)}
			</Link>
		</td>
	);
}

/** Every shared weekend, newest first; each place opens the session with both drivers compared. */
export function EventList({ events, pair }: { events: readonly H2HEvent[]; pair: Pair }) {
	return (
		<Panel>
			<PanelHeader title="Every weekend" meta={`${events.length}, newest first`} />
			<div className="max-h-120 overflow-auto px-4">
				<table className="w-full text-sm" data-testid="h2h-events">
					<caption className="sr-only">
						Weekends {pair.a.label} and {pair.b.label} shared
					</caption>
					<thead className="bg-panel sticky top-0">
						<tr className="border-b">
							<th scope="col" className="type-label py-1.5 text-left font-normal">
								Weekend
							</th>
							<th scope="col" className="type-label px-2 text-right font-normal">
								Q {pair.a.short}
							</th>
							<th scope="col" className="type-label px-2 text-right font-normal">
								Q {pair.b.short}
							</th>
							<th scope="col" className="type-label px-2 text-right font-normal">
								R {pair.a.short}
							</th>
							<th scope="col" className="type-label px-2 text-right font-normal">
								R {pair.b.short}
							</th>
						</tr>
					</thead>
					<tbody>
						{events.toReversed().map((event) => (
							<tr key={event.round.meetingKey} className="h-8 border-b last:border-b-0">
								<td className="truncate">{eventLabel(event)}</td>
								<Cell meeting={event.qualifying} side="a" other="b" />
								<Cell meeting={event.qualifying} side="b" other="a" />
								<Cell meeting={event.race} side="a" other="b" />
								<Cell meeting={event.race} side="b" other="a" />
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</Panel>
	);
}
