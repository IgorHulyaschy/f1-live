import type { Driver } from '@f1-live/shared';
import { SearchIcon } from 'lucide-react';
import * as React from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';

import { Digits } from '@/components/console/digits';
import { Key } from '@/components/console/keys';
import { Kbd, Panel, PanelHeader } from '@/components/console/panel';
import { TeamStripe } from '@/components/driver-tag';
import {
	availability,
	findSession,
	formatLocalStart,
	formatUntil,
	nextSession,
	type SessionEntry
} from '@/data/catalog';
import { useRace } from '@/data/race-context';
import { useIsRevealed } from '@/data/viewer-settings';
import { dashboardPath, SESSION_PATH } from '@/features/dashboard/paths';
import { useDashboards } from '@/features/dashboard/dashboard-store';
import { useCreateDashboard } from '@/features/dashboard/use-add-dashboard';
import { useDashboardNav } from '@/features/dashboard/use-dashboard-nav';
import { useDrill } from '@/features/drill/use-drill';
import { WelcomeBanner } from '@/features/library/welcome';
import { SessionPickerDialog } from '@/features/session/session-picker';
import { useNow } from '@/hooks/use-now';
import { cn } from '@/lib/utils';

import { type ChampionshipRow, championshipNow, type ChampionshipBasis } from './championship-now';
import { useOpenCommand } from './console-outlet';
import { latestWeekend, sessionTitle } from './latest-weekend';
import { HOME, isSessionLink, SESSION_START, startPageStore, startRedirect } from './start-page';

const LINK_KEY_CLASS =
	'type-label hover:text-foreground hover:border-rule-strong inline-flex h-9 shrink-0 items-center border border-b-2 px-2.5 transition-colors sm:h-7 focus-visible:ring-2 focus-visible:ring-(--color-ring) focus-visible:outline-none';

const BASIS_LABEL: Record<ChampionshipBasis, string> = {
	before: 'Before this session',
	after: 'After this session',
	live: 'If it ended now'
};

const HomeStandings = React.lazy(async () => ({
	default: (await import('./home-standings')).HomeStandings
}));

const SHOWN_DRIVERS = 5;

const SHOWN_TEAMS = 3;

function sessionSearch(key: string): string {
	return new URLSearchParams({ session: key }).toString();
}

/**
 * `/`: the home for a first visit, a link from before the home existed sent on to the session it
 * names, or a returning viewer's chosen start page.
 */
export function HomeRoute() {
	const location = useLocation();
	const [params] = useSearchParams();
	const start = startPageStore.useValue();
	const { dashboards } = useDashboards();
	// A replay position that arrives later comes from another window playing, not from a link.
	const [entry] = React.useState(() => new URLSearchParams(location.search));

	if (isSessionLink(entry) || params.has('session') || params.has('edit')) {
		return <Navigate replace to={{ pathname: SESSION_PATH, search: location.search }} />;
	}

	const target =
		location.key === 'default' && location.search === ''
			? startRedirect(
					start,
					dashboards.map((dashboard) => dashboard.id)
				)
			: null;

	return target ? <Navigate replace to={target} /> : <HomePage />;
}

/** The driver the home talks about: the one followed, else the championship leader. */
function useSubject(leader: string | undefined) {
	const { race, followedDriver } = useRace();

	const subject =
		race.drivers.find((driver) => driver.number === followedDriver) ??
		race.drivers.find((driver) => driver.number === leader) ??
		race.drivers[0];

	const rival = race.drivers.find(
		(driver) => driver.team === subject?.team && driver.number !== subject.number
	);

	return { subject, rival };
}

export function HomePage() {
	const { race, live, spoilers, catalog } = useRace();
	const table = championshipNow(race, { hidden: spoilers.hidden, live: live.isLive });
	const { subject, rival } = useSubject(table?.drivers[0]?.id);
	const [picking, setPicking] = React.useState(false);
	const weekend = catalog ? latestWeekend(catalog, live.liveKey) : [];

	// The open session's own table, while the season's standings load or where they are missing.
	const session = (
		<ChampionshipPanel
			className="min-[120rem]:col-span-2"
			basis={table?.basis ?? null}
			drivers={table?.drivers.slice(0, SHOWN_DRIVERS) ?? []}
			teams={table?.teams.slice(0, SHOWN_TEAMS) ?? []}
		/>
	);

	return (
		<div className="mx-auto flex max-w-[160rem] flex-col gap-6" data-testid="home">
			<WelcomeBanner />
			<AskBox subject={subject} rival={rival} onPickSession={() => setPicking(true)} />
			<Entries
				subject={subject}
				rival={rival}
				catchUp={weekend.findLast((entry) => entry.session.outputs.snapshot)}
				onPickSession={() => setPicking(true)}
			/>
			<div className="grid gap-4 lg:grid-cols-3 min-[120rem]:grid-cols-4">
				<NowPanel />
				<React.Suspense fallback={session}>
					<HomeStandings
						className="min-[120rem]:col-span-2"
						linkClassName={LINK_KEY_CLASS}
						fallback={session}
					/>
				</React.Suspense>
				<WeekendPanel weekend={weekend} />
			</div>
			<StartPagePicker />
			<SessionPickerDialog open={picking} onOpenChange={setPicking} />
		</div>
	);
}

function AskBox({
	subject,
	rival,
	onPickSession
}: {
	subject?: Driver;
	rival?: Driver;
	onPickSession: () => void;
}) {
	const openCommand = useOpenCommand();
	const navigate = useNavigate();
	const drill = useDrill();

	const examples = [
		subject
			? {
					label: `How is ${subject.lastName}’s weekend going?`,
					act: () => drill.open({ kind: 'driver', driverNumber: subject.number })
				}
			: null,
		{ label: 'Who has the best race pace?', act: () => void navigate('/analysis') },
		{ label: 'When is the next session?', act: onPickSession },
		subject && rival
			? {
					label: `${subject.code} or ${rival.code}: who is quicker?`,
					act: () => drill.open({ kind: 'compare', driverNumber: subject.number, vs: rival.number })
				}
			: null
	].filter((example) => example !== null);

	return (
		<section aria-labelledby="home-ask" className="flex flex-col gap-3">
			<h1 id="home-ask" className="type-wide text-2xl leading-none font-black italic md:text-4xl">
				Ask anything
			</h1>
			<button
				type="button"
				onClick={openCommand}
				data-testid="home-ask"
				aria-keyshortcuts="Meta+K Control+K"
				className="hover:border-rule-strong focus-visible:ring-(--color-ring) flex h-14 w-full items-center gap-3 border-2 px-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
			>
				<SearchIcon aria-hidden className="text-muted-foreground size-5 shrink-0" />
				<span className="text-muted-foreground min-w-0 flex-1 truncate">
					A driver, a session, a dashboard…
				</span>
				<Kbd className="max-sm:hidden">⌘K</Kbd>
			</button>
			<ul aria-label="Try asking" className="flex flex-wrap gap-2">
				{examples.map((example) => (
					<li key={example.label}>
						<button
							type="button"
							onClick={example.act}
							className="hover:text-foreground text-muted-foreground focus-visible:ring-(--color-ring) min-h-9 border-b px-1 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none sm:min-h-7"
						>
							{example.label}
						</button>
					</li>
				))}
			</ul>
		</section>
	);
}

/** One click to each way in. */
function Entries({
	subject,
	rival,
	catchUp,
	onPickSession
}: {
	subject?: Driver;
	rival?: Driver;
	catchUp?: SessionEntry;
	onPickSession: () => void;
}) {
	const { live } = useRace();
	const drill = useDrill();
	const create = useCreateDashboard();

	return (
		<nav aria-label="Start here" className="flex flex-wrap gap-2">
			{live.liveKey ? (
				<Link
					to={{ pathname: SESSION_PATH, search: sessionSearch(live.liveKey) }}
					data-testid="home-watch-live"
					className={cn(LINK_KEY_CLASS, 'border-foreground bg-foreground text-background')}
				>
					Watch live
				</Link>
			) : null}
			{catchUp ? (
				<Link
					to={{ pathname: SESSION_PATH, search: sessionSearch(catchUp.key) }}
					className={LINK_KEY_CLASS}
				>
					Catch up: {sessionTitle(catchUp)}
				</Link>
			) : null}
			<Key onClick={onPickSession}>All sessions</Key>
			{subject ? (
				<Key onClick={() => drill.open({ kind: 'driver', driverNumber: subject.number })}>
					Explore a driver
				</Key>
			) : null}
			{subject && rival ? (
				<Key
					onClick={() =>
						drill.open({ kind: 'compare', driverNumber: subject.number, vs: rival.number })
					}
				>
					Compare drivers
				</Key>
			) : null}
			<Key onClick={() => create()}>Build a dashboard</Key>
			<Link to="/library" className={LINK_KEY_CLASS}>
				Dashboards
			</Link>
		</nav>
	);
}

/** The session on now, or the next to start. */
function NowPanel() {
	const { catalog, live } = useRace();
	const now = useNow();
	const liveEntry = catalog && live.liveKey ? findSession(catalog, live.liveKey) : null;
	const next = catalog && !liveEntry ? nextSession(catalog, now) : null;

	return (
		<Panel aria-labelledby="home-now-title">
			<PanelHeader title={<span id="home-now-title">{liveEntry ? 'Live now' : 'Next'}</span>} />
			<div className="flex flex-col gap-3 px-4 py-4">
				{liveEntry ? (
					<div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="home-live">
						<span className="type-wide border-foreground bg-foreground text-background inline-flex h-7 items-center px-2 text-xs font-black italic">
							Live
						</span>
						<span className="type-wide min-w-0 text-lg font-black">{sessionTitle(liveEntry)}</span>
						<Link
							to={{ pathname: SESSION_PATH, search: sessionSearch(liveEntry.key) }}
							className={cn(LINK_KEY_CLASS, 'border-foreground bg-foreground text-background')}
						>
							Watch live
						</Link>
					</div>
				) : next ? (
					<div className="flex flex-col gap-1" data-testid="home-next">
						<span className="type-wide text-lg font-black">{sessionTitle(next)}</span>
						<span className="type-label">{formatLocalStart(next.session.startsAt)}</span>
						<span className="font-mono text-3xl" data-testid="home-countdown">
							{formatUntil(now, Date.parse(next.session.startsAt))}
						</span>
					</div>
				) : (
					<p className="text-muted-foreground text-sm" data-testid="home-no-next">
						Nothing on and nothing scheduled yet. Catch up on the latest weekend.
					</p>
				)}
			</div>
		</Panel>
	);
}

function ChampionshipPanel({
	basis,
	drivers,
	teams,
	className
}: {
	basis: ChampionshipBasis | null;
	drivers: readonly ChampionshipRow[];
	teams: readonly ChampionshipRow[];
	className?: string;
}) {
	const { race } = useRace();
	const drill = useDrill();
	const byNumber = new Map(race.drivers.map((driver) => [driver.number, driver]));

	return (
		<Panel aria-labelledby="home-championship-title" className={className}>
			<PanelHeader
				title={<span id="home-championship-title">Championship</span>}
				meta={basis ? BASIS_LABEL[basis] : undefined}
			>
				<Link to={dashboardPath('story')} className={LINK_KEY_CLASS}>
					Full standings
				</Link>
			</PanelHeader>
			{basis === null ? (
				<p className="text-muted-foreground px-4 py-4 text-sm">
					The standings arrive with the session.
				</p>
			) : (
				<div
					className="grid gap-x-6 gap-y-4 px-4 py-3 @2xl:grid-cols-2"
					data-testid="home-championship"
				>
					<ol aria-label="Drivers" className="flex flex-col">
						{drivers.map((row) => {
							const driver = byNumber.get(row.id);

							return (
								<li key={row.id} className="border-b last:border-b-0">
									<button
										type="button"
										disabled={!driver}
										onClick={() =>
											driver && drill.open({ kind: 'driver', driverNumber: driver.number })
										}
										className="hover:bg-accent focus-visible:bg-accent flex min-h-9 w-full min-w-0 items-center gap-3 px-1 text-left transition-colors focus-visible:outline-none"
									>
										<span className="text-muted-foreground w-5 font-mono text-xs">
											{row.position}
										</span>
										{driver ? <TeamStripe driver={driver} /> : null}
										<span className="type-wide min-w-0 flex-1 truncate text-sm font-bold">
											{driver ? `${driver.firstName} ${driver.lastName}` : `#${row.id}`}
										</span>
										<Digits className="font-mono text-sm" value={String(row.points)} />
									</button>
								</li>
							);
						})}
					</ol>
					<ol aria-label="Teams" className="flex flex-col">
						{teams.map((row) => {
							const driver = race.drivers.find((entry) => entry.team === row.id);

							return (
								<li
									key={row.id}
									className="flex min-h-9 min-w-0 items-center gap-3 border-b px-1 last:border-b-0"
								>
									<span className="text-muted-foreground w-5 font-mono text-xs">
										{row.position}
									</span>
									{driver ? <TeamStripe driver={driver} /> : null}
									<span className="type-wide min-w-0 flex-1 truncate text-sm font-bold">
										{row.id}
									</span>
									<Digits className="font-mono text-sm" value={String(row.points)} />
								</li>
							);
						})}
					</ol>
				</div>
			)}
		</Panel>
	);
}

/** The latest weekend's sessions, each one click from watching, never showing a result. */
function WeekendPanel({ weekend }: { weekend: readonly SessionEntry[] }) {
	const { live } = useRace();
	const isRevealed = useIsRevealed();
	const now = useNow();
	const meeting = weekend[0]?.meeting;

	return (
		<Panel aria-labelledby="home-weekend-title">
			<PanelHeader
				title={<span id="home-weekend-title">Latest weekend</span>}
				meta={meeting?.name}
			/>
			<ul className="flex flex-col px-4 py-2" data-testid="home-weekend">
				{weekend.map((entry) => {
					const state = availability(entry, live.liveKey, now);
					const to = { pathname: SESSION_PATH, search: sessionSearch(entry.key) };

					return (
						<li
							key={entry.key}
							className="flex min-h-11 min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-b py-1 last:border-b-0"
							data-testid={`home-session-${entry.key}`}
						>
							<span className="flex min-w-0 flex-1 flex-col">
								<span className="type-wide truncate text-sm font-bold">{entry.session.name}</span>
								<span className="type-label">{formatLocalStart(entry.session.startsAt)}</span>
							</span>
							{state === 'live' ? (
								<Link
									to={to}
									className={cn(LINK_KEY_CLASS, 'border-foreground bg-foreground text-background')}
								>
									Watch live
								</Link>
							) : state === 'saved' ? (
								<Link to={to} className={LINK_KEY_CLASS}>
									{isRevealed(entry.key) ? 'Watch again' : 'Catch up'}
								</Link>
							) : state === 'upcoming' ? (
								<span className="type-label">
									In {formatUntil(now, Date.parse(entry.session.startsAt))}
								</span>
							) : (
								<span className="type-label">Not saved</span>
							)}
						</li>
					);
				})}
			</ul>
		</Panel>
	);
}

/** Where the app opens next time: this home, the session or any dashboard. */
function StartPagePicker() {
	const start = startPageStore.useValue();
	const { all } = useDashboardNav();
	const id = React.useId();

	return (
		<div className="flex flex-wrap items-center gap-3 border-t pt-3">
			<label htmlFor={id} className="type-label">
				Open on
			</label>
			<select
				id={id}
				name="start-page"
				value={start}
				onChange={(event) => startPageStore.set(event.target.value)}
				data-testid="home-start-page"
				className="bg-background h-9 min-w-0 border px-2 text-sm sm:h-7"
			>
				<option value={HOME}>This home</option>
				<option value={SESSION_START}>The session on now</option>
				{all
					.filter((entry) => entry.path !== SESSION_PATH)
					.map((entry) => (
						<option key={entry.dashboard.id} value={entry.dashboard.id}>
							{entry.label}
						</option>
					))}
			</select>
		</div>
	);
}
