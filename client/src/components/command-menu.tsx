import { createResolver, questionText, suggest } from '@f1-live/shared/ask';
import {
	BellIcon,
	CalendarIcon,
	CalendarRangeIcon,
	CarIcon,
	DicesIcon,
	EyeIcon,
	EyeOffIcon,
	FlagIcon,
	HistoryIcon,
	LayoutDashboardIcon,
	LayoutGridIcon,
	MapPinIcon,
	MessageCircleQuestionIcon,
	MoonIcon,
	PlusIcon,
	RadioIcon,
	RotateCcwIcon,
	SettingsIcon,
	Share2Icon,
	ShieldIcon,
	SkipBackIcon,
	SkipForwardIcon,
	SparklesIcon,
	SquareArrowOutUpRightIcon,
	SunMediumIcon,
	UserIcon
} from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { Kbd } from '@/components/console/panel';
import { TeamStripe } from '@/components/driver-tag';
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut
} from '@/components/ui/command';
import { availability, formatLocalStart, sessionEntries } from '@/data/catalog';
import { useRace } from '@/data/race-context';
import { useSessionSnapshot } from '@/data/snapshots-context';
import { revealSession, useIsRevealed } from '@/data/viewer-settings';
import { useNow } from '@/hooks/use-now';
import { useAccountPlan } from '@/features/account/account-store';
import { AnswerCard } from '@/features/ask/answer-card';
import { answerTile } from '@/features/ask/answer-tile';
import {
	historyIndex,
	type IndexEntry,
	pageIndex,
	type PaletteGroup,
	rankGroups
} from '@/features/ask/ask-index';
import { type AskOutcome, answerQuery } from '@/features/ask/answers';
import { recentQuestions, rememberQuestion } from '@/features/ask/recent';
import { sessionHref } from '@/features/ask/ask-data';
import { examples, type Suggestion, surprise } from '@/features/ask/surprise';
import { useAskData } from '@/features/ask/use-ask-data';
import { useCreateDashboard } from '@/features/dashboard/use-add-dashboard';
import { addTile, TILE_INFO } from '@/features/dashboard/dashboards';
import { newId, saveDashboard } from '@/features/dashboard/dashboard-store';
import { useCarriedSearch } from '@/features/dashboard/use-carried-search';
import { useDashboardNav } from '@/features/dashboard/use-dashboard-nav';
import { LiveBadge, SessionPickerDialog } from '@/features/session/session-picker';
import { toggleTheme } from '@/hooks/use-theme';
import { OUT_LABEL } from '@/insights/standings';
import { keepAwakeStore, wakeLockSupported } from '@/platform/wake-lock';

/** One thing the palette offers: found by its names, done by `run`. */
type PaletteItem = {
	id: string;
	group: PaletteGroup;
	label: React.ReactNode;
	hint: React.ReactNode;
	names: readonly string[];
	icon: React.ReactNode;
	run: () => void;
};

const GROUP_ICON: Partial<Record<PaletteGroup, React.ReactNode>> = {
	Drivers: <UserIcon />,
	'Grands Prix': <MapPinIcon />,
	Teams: <CarIcon />,
	Seasons: <CalendarRangeIcon />,
	Pages: <SquareArrowOutUpRightIcon />
};

const ROTATE_MS = 3500;

const SNAPSHOT_DELAY_MS = 250;

/** `value` once it has stayed the same for `delay` ms. */
function useSettled<T>(value: T, delay: number): T {
	const [settled, setSettled] = React.useState(value);

	React.useEffect(() => {
		const timer = window.setTimeout(() => setSettled(value), delay);

		return () => window.clearTimeout(timer);
	}, [value, delay]);

	return settled;
}

/** A placeholder that cycles through questions to try while the input is empty. */
function useRotatingPlaceholder(questions: readonly string[], active: boolean): string {
	const [index, setIndex] = React.useState(0);

	React.useEffect(() => {
		if (!active || questions.length < 2) {
			return;
		}

		const timer = window.setInterval(() => setIndex((current) => current + 1), ROTATE_MS);

		return () => window.clearInterval(timer);
	}, [active, questions.length]);

	const question = questions.length > 0 ? questions[index % questions.length] : undefined;

	return question ? `Try “${question}”` : 'Ask about F1, or jump to anything…';
}

/** Copies a link that opens Ask on this question. */
async function shareQuestion(question: string) {
	const url = new URL('/', window.location.origin);

	url.searchParams.set('ask', question);
	await navigator.clipboard.writeText(url.toString()).catch(() => undefined);
	toast('Link copied', { description: 'It opens this question with its answer.' });
}

/**
 * ⌘K: ask a question about F1 and get the answer with its proof, or find any driver, team, grand
 * prix, season, page, session, dashboard or setting by name, typos allowed.
 */
export function CommandMenu({
	open,
	onOpenChange,
	text,
	onTextChange
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	text: string;
	onTextChange: (text: string) => void;
}) {
	const {
		race,
		setLap,
		plan,
		setPlan,
		followedDriver,
		setFollowedDriver,
		standings,
		catalog,
		setSession,
		live,
		spoilers,
		lap,
		steps,
		stepUnit
	} = useRace();

	const accountPlan = useAccountPlan();
	const navigate = useNavigate();
	const search = useCarriedSearch();
	const { all: pages } = useDashboardNav();
	const create = useCreateDashboard();
	const [picking, setPicking] = React.useState(false);
	const keepAwake = keepAwakeStore.useValue();
	const now = useNow();
	const isRevealed = useIsRevealed();
	const recent = recentQuestions.useValue();
	const { data, error: resultsError, retry: retryResults } = useAskData();
	const typed = text.trim();

	const resolver = React.useMemo(() => (data ? createResolver(data.context) : null), [data]);

	const query = React.useMemo(
		() => (resolver && typed !== '' ? resolver(typed) : null),
		[resolver, typed]
	);

	const question = query && data ? questionText(query, data.context) : null;

	// Answers that need a session's saved data ask for it once the typing settles; the reply waits.
	const first = React.useMemo(
		() => (query && data ? answerQuery(data, query, null) : null),
		[data, query]
	);

	const wanted = useSettled(first?.kind === 'snapshot' ? first.key : null, SNAPSHOT_DELAY_MS);
	const loaded = useSessionSnapshot(first?.kind === 'snapshot' ? wanted : null);

	const answerTileKind = query && data ? answerTile(data, query) : null;

	const outcome = React.useMemo((): AskOutcome | { kind: 'loading'; label: string } | null => {
		if (first?.kind !== 'snapshot' || !query || !data) {
			return first;
		}

		if (wanted === first.key && loaded.status === 'ready') {
			return answerQuery(data, query, loaded.snapshot);
		}

		return wanted === first.key && loaded.status === 'error'
			? { kind: 'missing', message: `The ${first.label} could not be loaded.` }
			: { kind: 'loading', label: `the ${first.label}` };
	}, [first, query, data, wanted, loaded]);

	// The first answer item is selected as the answer arrives, so Enter opens its proof.
	const answerItem =
		outcome?.kind === 'answer' ? 'ask-proof' : outcome?.kind === 'held' ? 'ask-open-held' : null;

	const [selected, setSelected] = React.useState('');
	const [selectedFor, setSelectedFor] = React.useState<string | null>(null);

	if (answerItem !== selectedFor) {
		setSelectedFor(answerItem);

		if (answerItem) {
			setSelected(answerItem);
		}
	}

	// A fresh set of questions each time the palette opens, kept while it stays open.
	const [tryAsking, setTryAsking] = React.useState<readonly Suggestion[]>([]);
	const [examplesFor, setExamplesFor] = React.useState({ open: false, ready: false });

	if (open !== examplesFor.open || (data !== null) !== examplesFor.ready) {
		setExamplesFor({ open, ready: data !== null });
		setTryAsking(open && data ? examples(data) : []);
	}

	const placeholder = useRotatingPlaceholder(
		tryAsking.map((example) => example.text),
		open && typed === ''
	);

	const close = () => onOpenChange(false);

	const run = (action: () => void) => {
		action();
		close();
	};

	// Leaving through an answer's link keeps the question among the recent ones.
	const leave = () => {
		if (question) {
			rememberQuestion(question);
		}

		close();
	};

	const follow = (href: string) => {
		leave();
		void navigate(href);
	};

	const byLap = stepUnit === 'lap';

	// The latest state follows live on a live session, and shows results only by revealing them.
	const showLatest = () => {
		if (live.isLive) {
			live.backToLive();
		} else if (spoilers.hidden) {
			spoilers.reveal();
			setLap(steps);
		} else {
			setLap(steps);
		}
	};

	const index = React.useMemo(() => (data ? historyIndex(data) : pageIndex()), [data]);

	const items = ((): PaletteItem[] => {
		if (typed === '') {
			return [];
		}

		const history = index.map((entry: IndexEntry): PaletteItem => ({
			id: entry.id,
			group: entry.group,
			label: entry.label,
			hint: entry.hint,
			names: entry.names,
			icon: GROUP_ICON[entry.group] ?? null,
			run: () => void navigate(entry.carry ? { pathname: entry.href, search } : entry.href)
		}));

		const drivers = standings.map((row): PaletteItem => ({
			id: `follow-${row.driver.number}`,
			group: 'Follow',
			label: (
				<>
					<span className="font-display w-10 font-semibold">{row.driver.code}</span>
					<span className="text-muted-foreground truncate">
						Follow {row.driver.firstName} {row.driver.lastName}
					</span>
				</>
			),
			hint:
				row.driver.number === followedDriver
					? 'Following'
					: row.out
						? OUT_LABEL[row.out]
						: `P${row.position}`,
			names: [
				row.driver.code,
				`${row.driver.firstName} ${row.driver.lastName}`,
				row.driver.lastName,
				row.driver.team,
				`follow ${row.driver.lastName}`
			],
			icon: <TeamStripe driver={row.driver} />,
			run: () => setFollowedDriver(row.driver.number)
		}));

		const dashboards = [
			...pages.map((page, position): PaletteItem => ({
				id: `dashboard-${page.dashboard.id}`,
				group: 'Dashboards',
				label: page.label,
				hint: position < 9 ? String(position + 1) : null,
				names: [page.label, page.dashboard.name, `${page.label} dashboard`],
				icon: <LayoutDashboardIcon />,
				run: () => void navigate({ pathname: page.path, search })
			})),
			{
				id: 'dashboard-new',
				group: 'Dashboards',
				label: 'New dashboard',
				hint: null,
				names: ['new dashboard', 'create dashboard'],
				icon: <PlusIcon />,
				run: () => create()
			} satisfies PaletteItem
		];

		const tiles = [
			...new Map(
				pages.flatMap((page) =>
					page.dashboard.tiles.map((tile) => [tile.kind, { kind: tile.kind, page }] as const)
				)
			).values()
		].map(({ kind, page }): PaletteItem => ({
			id: `tile-${kind}`,
			group: 'Tiles',
			label: TILE_INFO[kind].title,
			hint: `on ${page.label}`,
			names: [TILE_INFO[kind].title, `${TILE_INFO[kind].title} tile`],
			icon: <LayoutGridIcon />,
			run: () => void navigate({ pathname: page.path, search })
		}));

		const sessions = (catalog ? sessionEntries(catalog) : [])
			.filter((entry) => availability(entry, live.liveKey, now) !== 'missing')
			.map((entry): PaletteItem => {
				const state = availability(entry, live.liveKey, now);
				const event = entry.meeting.name.replace(/ Grand Prix$/, '');

				return {
					id: `session-${entry.key}`,
					group: 'Sessions',
					label: `${entry.year} ${event}, ${entry.session.name}`,
					hint:
						state === 'live' ? (
							<LiveBadge />
						) : state === 'upcoming' ? (
							formatLocalStart(entry.session.startsAt)
						) : isRevealed(entry.key) ? null : (
							'Results hidden'
						),
					names: [
						`${entry.year} ${event} ${entry.session.name}`,
						`${event} ${entry.year} ${entry.session.name}`,
						`${entry.meeting.location} ${entry.year} ${entry.session.name}`,
						entry.key
					],
					icon: state === 'live' ? <RadioIcon /> : <CalendarIcon />,
					run: () => setSession(entry.key)
				};
			});

		// Neutralised laps are a race's; while what lies ahead is hidden, only those shown are offered.
		const neutralised = byLap
			? [
					...new Set(
						race.laps.flatMap((entry) =>
							entry.trackStatus !== 'green' && (!spoilers.hidesAhead || entry.lap <= lap)
								? [entry.lap]
								: []
						)
					)
				]
			: [];

		const asked = /^lap (\d+)$/i.exec(typed);
		const askedLap = asked ? Number(asked[1]) : null;

		const session: PaletteItem[] = [
			{
				id: 'session-start',
				group: 'Session',
				label: byLap ? 'Start of the race' : 'Start of the session',
				hint: null,
				names: ['start', 'lap 1', 'beginning', 'restart'],
				icon: <SkipBackIcon />,
				run: () => setLap(1)
			},
			{
				id: 'session-latest',
				group: 'Session',
				label: spoilers.hidden
					? 'Jump to the finish (shows results)'
					: byLap
						? 'Latest lap'
						: 'Latest minute',
				hint: null,
				names: ['latest', 'finish', 'end', 'live', 'latest lap'],
				icon: <SkipForwardIcon />,
				run: showLatest
			},
			...neutralised.map((neutralisedLap): PaletteItem => ({
				id: `lap-${neutralisedLap}`,
				group: 'Session',
				label: `Lap ${neutralisedLap}: neutralised`,
				hint: null,
				names: [`lap ${neutralisedLap}`, 'vsc', 'safety car', 'neutralised'],
				icon: <FlagIcon />,
				run: () => setLap(neutralisedLap)
			})),
			...(byLap &&
			askedLap !== null &&
			askedLap >= 1 &&
			askedLap <= steps &&
			(!spoilers.hidesAhead || askedLap <= lap)
				? [
						{
							id: 'lap-asked',
							group: 'Session',
							label: `Go to lap ${askedLap}`,
							hint: null,
							names: [`lap ${askedLap}`],
							icon: <FlagIcon />,
							run: () => setLap(askedLap)
						} satisfies PaletteItem
					]
				: [])
		];

		const settings: PaletteItem[] = [
			...(accountPlan === 'pro'
				? []
				: [
						{
							id: 'plan',
							group: 'Settings',
							label: plan === 'pro' ? 'Back to the free plan' : 'Preview Pro',
							hint: null,
							names: ['preview pro', 'plan', 'free plan', 'pro'],
							icon: <SparklesIcon />,
							run: () => setPlan(plan === 'pro' ? 'free' : 'pro')
						} satisfies PaletteItem
					]),
			{
				id: 'alerts',
				group: 'Settings',
				label: 'Alerts',
				hint: null,
				names: ['alerts', 'notifications', 'push'],
				icon: <BellIcon />,
				run: () => void navigate({ pathname: '/alerts', search })
			},
			{
				id: 'theme',
				group: 'Settings',
				label: 'Toggle theme',
				hint: null,
				names: ['toggle theme', 'dark mode', 'light mode', 'theme'],
				icon: <MoonIcon />,
				run: toggleTheme
			},
			{
				id: 'spoilers',
				group: 'Settings',
				label: spoilers.protect ? 'Turn spoiler protection off' : 'Turn spoiler protection on',
				hint: null,
				names: ['spoiler protection', 'hide results', 'spoilers'],
				icon: <ShieldIcon />,
				run: () => spoilers.setProtect(!spoilers.protect)
			},
			...(wakeLockSupported()
				? [
						{
							id: 'awake',
							group: 'Settings',
							label: keepAwake
								? 'Let the screen sleep'
								: 'Keep the screen awake while a race plays',
							hint: null,
							names: ['screen awake', 'wake lock', 'sleep'],
							icon: <SunMediumIcon />,
							run: () => keepAwakeStore.set(!keepAwake)
						} satisfies PaletteItem
					]
				: [])
		];

		return [...history, ...drivers, ...dashboards, ...tiles, ...sessions, ...session, ...settings];
	})();

	const groups = typed === '' ? [] : rankGroups(items, typed);
	const suggestions = data && typed !== '' && !query ? suggest(typed, data.context) : [];

	return (
		<>
			<CommandDialog
				open={open}
				onOpenChange={onOpenChange}
				title="Ask"
				description="Ask a question about F1, or find a driver, grand prix, season, page, session or dashboard."
				shouldFilter={false}
				value={selected}
				onValueChange={setSelected}
				fullScreenOnPhone
				className="sm:max-w-xl"
			>
				<CommandInput
					placeholder={placeholder}
					value={text}
					onValueChange={onTextChange}
					data-testid="ask-input"
				/>
				<CommandList className="max-h-[min(70svh,560px)] max-sm:max-h-none max-sm:flex-1">
					<CommandEmpty>
						{data
							? 'Nothing matches. Try “Who won the last race”.'
							: resultsError
								? 'The results could not be loaded.'
								: 'Loading the results…'}
					</CommandEmpty>
					{resultsError && !data ? (
						<CommandGroup heading="Answers">
							<p role="alert" className="text-muted-foreground px-2 py-1.5 text-sm">
								The results could not be loaded: {resultsError}
							</p>
							<CommandItem value="ask-retry" onSelect={retryResults} data-testid="ask-retry">
								<RotateCcwIcon />
								Try again
							</CommandItem>
						</CommandGroup>
					) : null}
					{outcome ? <AnswerCard outcome={outcome} onNavigate={leave} /> : null}
					{outcome?.kind === 'answer' ? (
						<CommandGroup heading="Answer">
							<CommandItem
								value="ask-proof"
								onSelect={() => follow(outcome.proof.href)}
								data-testid="ask-proof"
							>
								<SquareArrowOutUpRightIcon />
								{outcome.proof.label}
								<CommandShortcut>↵</CommandShortcut>
							</CommandItem>
							{question ? (
								<CommandItem
									value="ask-share"
									onSelect={() => {
										rememberQuestion(question);
										void shareQuestion(question);
									}}
								>
									<Share2Icon />
									Share this answer
								</CommandItem>
							) : null}
						</CommandGroup>
					) : null}
					{outcome?.kind === 'answer' && answerTileKind ? (
						<CommandGroup heading={`Add ${TILE_INFO[answerTileKind].title} to a dashboard`}>
							{pages.map((page) => (
								<CommandItem
									key={page.dashboard.id}
									value={`ask-add-${page.dashboard.id}`}
									onSelect={() => {
										saveDashboard(addTile(page.dashboard, answerTileKind, newId(answerTileKind)));
										toast(`${TILE_INFO[answerTileKind].title} added to ${page.label}`, {
											action: {
												label: 'Open',
												onClick: () => void navigate({ pathname: page.path, search })
											}
										});

										if (question) {
											rememberQuestion(question);
										}

										onOpenChange(false);
									}}
									data-testid={`ask-add-${page.dashboard.id}`}
								>
									<PlusIcon />
									{page.label}
								</CommandItem>
							))}
						</CommandGroup>
					) : null}
					{outcome?.kind === 'held' ? (
						<CommandGroup heading="Answer">
							<CommandItem
								value="ask-open-held"
								onSelect={() => follow(sessionHref(outcome.sessions[0]?.key ?? ''))}
							>
								<SquareArrowOutUpRightIcon />
								Watch it from the start
							</CommandItem>
							<CommandItem
								value="ask-reveal"
								onSelect={() => {
									for (const session of outcome.sessions) {
										revealSession(session.key);
									}
								}}
								data-testid="ask-reveal"
							>
								<EyeIcon />
								Reveal the result
							</CommandItem>
						</CommandGroup>
					) : null}
					{groups.map(({ group, entries }) => (
						<CommandGroup key={group} heading={group}>
							{entries.map((item) => (
								<CommandItem key={item.id} value={item.id} onSelect={() => run(item.run)}>
									{item.icon}
									<span className="flex min-w-0 items-center gap-2 truncate">{item.label}</span>
									{item.hint ? <CommandShortcut>{item.hint}</CommandShortcut> : null}
								</CommandItem>
							))}
						</CommandGroup>
					))}
					{/* Below the names the text matches, so Enter on a name opens it rather than a rewrite. */}
					{suggestions.length > 0 ? (
						<CommandGroup heading="Try asking">
							{suggestions.map((suggestion) => (
								<CommandItem
									key={suggestion}
									value={`suggest ${suggestion}`}
									onSelect={() => onTextChange(suggestion)}
								>
									<MessageCircleQuestionIcon />
									{suggestion}
								</CommandItem>
							))}
						</CommandGroup>
					) : null}
					{typed === '' ? (
						<>
							<CommandGroup heading="Ask">
								{data ? (
									<CommandItem
										value="ask-surprise"
										onSelect={() => {
											const pick = surprise(data);

											if (pick) {
												onTextChange(pick.text);
											}
										}}
										data-testid="ask-surprise"
									>
										<DicesIcon />
										Surprise me
										<CommandShortcut>A true fact, with its proof</CommandShortcut>
									</CommandItem>
								) : null}
								{tryAsking.map((example) => (
									<CommandItem
										key={example.text}
										value={`example ${example.text}`}
										onSelect={() => onTextChange(example.text)}
									>
										<MessageCircleQuestionIcon />
										{example.text}
									</CommandItem>
								))}
							</CommandGroup>
							{recent.length > 0 ? (
								<CommandGroup heading="Recent">
									{recent.map((entry) => (
										<CommandItem
											key={entry}
											value={`recent ${entry}`}
											onSelect={() => onTextChange(entry)}
										>
											<HistoryIcon />
											{entry}
										</CommandItem>
									))}
								</CommandGroup>
							) : null}
							<CommandSeparator />
							<CommandGroup heading="Go to">
								{pageIndex().map((page) => (
									<CommandItem
										key={page.id}
										value={page.id}
										onSelect={() =>
											run(
												() =>
													void navigate(page.carry ? { pathname: page.href, search } : page.href)
											)
										}
									>
										<SquareArrowOutUpRightIcon />
										{page.label}
										<CommandShortcut className="max-sm:hidden">{page.hint}</CommandShortcut>
									</CommandItem>
								))}
								<CommandItem value="all-sessions" onSelect={() => run(() => setPicking(true))}>
									<CalendarIcon />
									All sessions…
								</CommandItem>
							</CommandGroup>
							<CommandGroup heading="Session">
								<CommandItem value="session-start" onSelect={() => run(() => setLap(1))}>
									<SkipBackIcon />
									{byLap ? 'Start of the race' : 'Start of the session'}
								</CommandItem>
								<CommandItem value="session-latest" onSelect={() => run(showLatest)}>
									<SkipForwardIcon />
									{spoilers.hidden
										? 'Jump to the finish (shows results)'
										: byLap
											? 'Latest lap'
											: 'Latest minute'}
								</CommandItem>
							</CommandGroup>
							<CommandGroup heading="Dashboards">
								{pages.map((page, position) => (
									<CommandItem
										key={page.dashboard.id}
										value={`dashboard-${page.dashboard.id}`}
										onSelect={() => run(() => void navigate({ pathname: page.path, search }))}
									>
										<LayoutDashboardIcon />
										{page.label}
										{position < 9 ? <CommandShortcut>{position + 1}</CommandShortcut> : null}
									</CommandItem>
								))}
							</CommandGroup>
							<CommandGroup heading="Settings">
								<CommandItem value="theme" onSelect={() => run(toggleTheme)}>
									<MoonIcon />
									Toggle theme
								</CommandItem>
								<CommandItem
									value="spoilers"
									onSelect={() => run(() => spoilers.setProtect(!spoilers.protect))}
								>
									<EyeOffIcon />
									{spoilers.protect ? 'Turn spoiler protection off' : 'Turn spoiler protection on'}
								</CommandItem>
								<CommandItem value="settings-more" onSelect={() => onTextChange('settings')}>
									<SettingsIcon />
									More settings…
								</CommandItem>
							</CommandGroup>
						</>
					) : null}
				</CommandList>
				<footer className="type-label hidden items-center gap-4 border-t px-3 py-2 sm:flex">
					<span className="flex items-center gap-1.5">
						<Kbd>↵</Kbd> open
					</span>
					<span className="flex items-center gap-1.5">
						<Kbd>↑↓</Kbd> move
					</span>
					<span className="flex items-center gap-1.5">
						<Kbd>esc</Kbd> close
					</span>
					<span className="ml-auto">Every number links to its source</span>
				</footer>
			</CommandDialog>
			<SessionPickerDialog open={picking} onOpenChange={setPicking} />
		</>
	);
}
