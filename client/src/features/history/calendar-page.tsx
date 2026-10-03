import { DownloadIcon } from 'lucide-react';
import * as React from 'react';
import { Link, useSearchParams } from 'react-router';

import { BRAND, brandSlug } from '@/brand';
import { Key } from '@/components/console/keys';
import { Panel, PanelHeader } from '@/components/console/panel';
import { SeasonSwitch } from '@/components/season-switch';
import { type CatalogSession, formatUntil, SESSION_TYPE_LABEL } from '@/data/catalog';
import { useRace } from '@/data/race-context';
import { useNow } from '@/hooks/use-now';
import { type CalendarRound, calendarIcs, currentRound, seasonCalendar } from '@/insights/calendar';
import { cn } from '@/lib/utils';

import { PageTitle, useYears } from './history-data';

function localDay(iso: string): string {
	return new Intl.DateTimeFormat(undefined, {
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	}).format(new Date(iso));
}

function localTime(iso: string): string {
	return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(
		new Date(iso)
	);
}

function dayMonth(date: Date): string {
	return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(date);
}

function dateRange(round: CalendarRound): string {
	const from = new Date(round.startsAt);
	const to = new Date(round.endsAt);

	return from.getMonth() === to.getMonth()
		? `${from.getDate()}–${dayMonth(to)}`
		: `${dayMonth(from)} – ${dayMonth(to)}`;
}

function saveIcs(
	rounds: readonly CalendarRound[],
	year: number,
	upcomingOnly: boolean,
	now: number
) {
	const chosen = upcomingOnly ? rounds.filter((round) => Date.parse(round.endsAt) >= now) : rounds;

	const text = calendarIcs(chosen, {
		name: `${BRAND.name} ${year}`,
		origin: window.location.origin,
		host: new URL(BRAND.origin).host,
		stamp: new Date(now).toISOString()
	});

	const link = document.createElement('a');

	link.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
	link.download = `${brandSlug()}-${year}${upcomingOnly ? '-upcoming' : ''}.ics`;
	link.click();
	URL.revokeObjectURL(link.href);
}

function SessionLine({
	session,
	now,
	liveKey
}: {
	session: CatalogSession;
	now: number;
	liveKey: string | null;
}) {
	const live = String(session.key) === liveKey;
	const upcoming = Date.parse(session.startsAt) > now;
	const opens = live || session.outputs.snapshot;

	const label = (
		<>
			<span className="type-label w-28 shrink-0">{session.name}</span>
			<span className="font-mono text-xs">
				{localDay(session.startsAt)} {localTime(session.startsAt)}
			</span>
			{live ? (
				<span className="type-label bg-foreground text-background ml-auto px-1.5">Live</span>
			) : upcoming ? (
				<span className="type-label text-muted-foreground ml-auto">
					in {formatUntil(now, Date.parse(session.startsAt))}
				</span>
			) : null}
		</>
	);

	return (
		<li className="border-b last:border-b-0" data-testid={`calendar-session-${session.key}`}>
			{opens ? (
				<Link
					to={`/?session=${session.key}`}
					className="hover:bg-accent focus-visible:bg-accent flex min-h-9 items-center gap-3 px-2 transition-colors focus-visible:outline-none"
					aria-label={`${session.name}, ${localDay(session.startsAt)} ${localTime(session.startsAt)}`}
				>
					{label}
				</Link>
			) : (
				<div className="text-muted-foreground flex min-h-9 items-center gap-3 px-2">{label}</div>
			)}
		</li>
	);
}

/**
 * `/calendar`: a season's weekends in the viewer's time, the next session counted down, every
 * session one click from its replay, and the season as an .ics file. No results are shown, so the
 * page is safe to open before a catch-up.
 */
export function CalendarPage() {
	const years = useYears();
	const { catalog, live } = useRace();
	const [params, setParams] = useSearchParams();
	const now = useNow();
	const year = Number(params.get('season')) || (years.at(-1) ?? 0);

	const rounds = React.useMemo(
		() => (catalog ? seasonCalendar(catalog, year) : []),
		[catalog, year]
	);

	const current = currentRound(rounds, now);
	const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;

	const next = rounds
		.flatMap((round) => round.meeting.sessions.map((session) => ({ round, session })))
		.find(({ session }) => Date.parse(session.startsAt) > now);

	// The weekend on now opens in view, as far into a long season as it is.
	const scrollToCurrent = React.useCallback((element: HTMLLIElement | null) => {
		element?.scrollIntoView({ block: 'center' });
	}, []);

	return (
		<div className="flex flex-col gap-6" data-testid="calendar-page">
			<PageTitle title="Calendar">
				Every weekend of the season in your time ({zone}). Results are not shown here, so nothing is
				spoiled; each session opens its replay, or counts down to its start.
			</PageTitle>
			<div className="flex flex-wrap items-center gap-2">
				{years.length > 0 ? (
					<SeasonSwitch
						years={years}
						value={year}
						onChange={(value) => setParams({ season: String(value) }, { replace: true })}
					/>
				) : null}
				<Key onClick={() => saveIcs(rounds, year, false, now)}>
					<DownloadIcon aria-hidden />
					Season .ics
				</Key>
				<Key onClick={() => saveIcs(rounds, year, true, now)} disabled={!next}>
					<DownloadIcon aria-hidden />
					Upcoming .ics
				</Key>
			</div>
			{next ? (
				<p
					className="border-rule-strong flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t-2 border-b py-3"
					data-testid="calendar-next"
				>
					<span className="type-label">Next</span>
					<span className="type-wide text-sm font-bold">
						{next.round.meeting.name}:{' '}
						{SESSION_TYPE_LABEL[next.session.type] === next.session.name
							? next.session.name
							: next.session.name}
					</span>
					<span className="font-mono text-sm">
						{localDay(next.session.startsAt)} {localTime(next.session.startsAt)}
					</span>
					<span className="font-mono text-2xl font-bold">
						in {formatUntil(now, Date.parse(next.session.startsAt))}
					</span>
				</p>
			) : null}
			<ol className="grid gap-6 lg:grid-cols-2">
				{rounds.map((round) => {
					const isCurrent = round === current;

					return (
						<li
							key={round.meeting.key}
							ref={isCurrent ? scrollToCurrent : undefined}
							data-testid={`calendar-round-${round.meeting.key}`}
							aria-current={isCurrent ? 'date' : undefined}
						>
							<Panel className={cn(isCurrent && 'outline-focus outline-2')}>
								<PanelHeader
									title={
										<span className="flex items-baseline gap-2">
											<span className="font-mono">
												{round.round === null ? 'TEST' : `R${round.round}`}
											</span>
											{round.meeting.name}
										</span>
									}
									meta={`${round.meeting.location}, ${dateRange(round)}`}
								/>
								<ul>
									{round.meeting.sessions.map((session) => (
										<SessionLine
											key={session.key}
											session={session}
											now={now}
											liveKey={live.liveKey}
										/>
									))}
								</ul>
							</Panel>
						</li>
					);
				})}
			</ol>
		</div>
	);
}
