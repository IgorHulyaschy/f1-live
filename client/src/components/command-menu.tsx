import {
	CalendarIcon,
	EyeOffIcon,
	FlagIcon,
	LayoutDashboardIcon,
	MoonIcon,
	PlusIcon,
	RadioIcon,
	SkipBackIcon,
	SkipForwardIcon,
	SparklesIcon,
	SunMediumIcon
} from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router';

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
import { availability, formatLocalStart, type SessionEntry, sessionEntries } from '@/data/catalog';
import { useRace } from '@/data/race-context';
import { useNow } from '@/hooks/use-now';
import { useAccountPlan } from '@/features/account/account-store';
import { useCreateDashboard } from '@/features/dashboard/dashboard-page';
import { useDashboards } from '@/features/dashboard/dashboard-store';
import { dashboardPath } from '@/features/dashboard/paths';
import { useCarriedSearch } from '@/features/dashboard/use-carried-search';
import { LiveBadge, SessionPickerDialog } from '@/features/session/session-picker';
import { toggleTheme } from '@/hooks/use-theme';
import { OUT_LABEL } from '@/insights/standings';
import { keepAwakeStore, wakeLockSupported } from '@/platform/wake-lock';

/**
 * Sessions worth offering before the viewer types: the live one and the rest of this meeting.
 * Typing searches every session there is.
 */
function suggestedSessions(
	entries: readonly SessionEntry[],
	current: string,
	liveKey: string | null,
	searching: boolean
): SessionEntry[] {
	const meetingKey = entries.find((entry) => entry.key === current)?.meeting.key;

	return entries.filter(
		(entry) =>
			entry.key !== current &&
			(searching || entry.key === liveKey || entry.meeting.key === meetingKey)
	);
}

/** ⌘K: follow any driver, jump to a page or lap, or flip settings without hunting for controls. */
export function CommandMenu({
	open,
	onOpenChange
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
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
		sessionKey,
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
	const { dashboards } = useDashboards();
	const create = useCreateDashboard();
	const [query, setQuery] = React.useState('');
	const [picking, setPicking] = React.useState(false);
	const keepAwake = keepAwakeStore.useValue();
	const rows = standings;
	const now = useNow();

	const sessions = suggestedSessions(
		catalog ? sessionEntries(catalog) : [],
		sessionKey,
		live.liveKey,
		query.trim() !== ''
	).filter((entry) => availability(entry, live.liveKey, now) !== 'missing');

	const run = (action: () => void) => {
		action();
		onOpenChange(false);
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

	// Neutralised laps are a race's; spoiler-free, only those already shown are offered.
	const neutralisedLaps = byLap
		? [
				...new Set(
					race.laps
						.filter(
							(entry) => entry.trackStatus !== 'green' && (!spoilers.hidden || entry.lap <= lap)
						)
						.map((entry) => entry.lap)
				)
			]
		: [];

	return (
		<>
			<CommandDialog
				open={open}
				onOpenChange={onOpenChange}
				title="Jump to"
				description="Follow a driver, open a dashboard or session, or move through the race."
			>
				<CommandInput
					placeholder="Driver, dashboard, session or lap…"
					value={query}
					onValueChange={setQuery}
				/>
				<CommandList>
					<CommandEmpty>Nothing matches.</CommandEmpty>
					<CommandGroup heading="Follow driver">
						{rows.map((row) => (
							<CommandItem
								key={row.driver.number}
								value={`${row.driver.code} ${row.driver.firstName} ${row.driver.lastName} ${row.driver.team}`}
								onSelect={() => run(() => setFollowedDriver(row.driver.number))}
							>
								<TeamStripe driver={row.driver} />
								<span className="font-display w-10 font-semibold">{row.driver.code}</span>
								<span className="text-muted-foreground truncate">
									{row.driver.firstName} {row.driver.lastName}
								</span>
								<CommandShortcut>
									{row.driver.number === followedDriver
										? 'Following'
										: row.out
											? OUT_LABEL[row.out]
											: `P${row.position}`}
								</CommandShortcut>
							</CommandItem>
						))}
					</CommandGroup>
					<CommandSeparator />
					<CommandGroup heading="Dashboards">
						{dashboards.map((dashboard, index) => (
							<CommandItem
								key={dashboard.id}
								value={`dashboard ${dashboard.name}`}
								onSelect={() =>
									run(() => void navigate({ pathname: dashboardPath(dashboard.id), search }))
								}
							>
								<LayoutDashboardIcon />
								{dashboard.name}
								{index < 9 ? <CommandShortcut>{index + 1}</CommandShortcut> : null}
							</CommandItem>
						))}
						<CommandItem value="new dashboard" onSelect={() => run(() => create())}>
							<PlusIcon />
							New dashboard
						</CommandItem>
					</CommandGroup>
					<CommandSeparator />
					<CommandGroup heading="Sessions">
						{sessions.map((entry) => {
							const state = availability(entry, live.liveKey, now);

							return (
								<CommandItem
									key={entry.key}
									value={`session ${entry.year} ${entry.meeting.name} ${entry.meeting.location} ${entry.session.name} ${entry.key}`}
									onSelect={() => run(() => setSession(entry.key))}
								>
									{state === 'live' ? <RadioIcon /> : <CalendarIcon />}
									<span className="truncate">
										{entry.year} {entry.meeting.name.replace(/ Grand Prix$/, '')},{' '}
										{entry.session.name}
									</span>
									<CommandShortcut>
										{state === 'live' ? (
											<LiveBadge />
										) : state === 'upcoming' ? (
											formatLocalStart(entry.session.startsAt)
										) : null}
									</CommandShortcut>
								</CommandItem>
							);
						})}
						<CommandItem
							value="all sessions season meeting calendar"
							onSelect={() => run(() => setPicking(true))}
						>
							<CalendarIcon />
							All sessions…
						</CommandItem>
					</CommandGroup>
					<CommandSeparator />
					<CommandGroup heading={byLap ? 'Race' : 'Session'}>
						<CommandItem onSelect={() => run(() => setLap(1))}>
							<SkipBackIcon />
							{byLap ? 'Start of the race' : 'Start of the session'}
						</CommandItem>
						<CommandItem onSelect={() => run(showLatest)}>
							<SkipForwardIcon />
							{byLap ? 'Latest lap' : 'Latest minute'}
						</CommandItem>
						{neutralisedLaps.map((neutralised) => (
							<CommandItem
								key={neutralised}
								value={`lap ${neutralised} vsc neutralised`}
								onSelect={() => run(() => setLap(neutralised))}
							>
								<FlagIcon />
								Lap {neutralised}: neutralised
							</CommandItem>
						))}
					</CommandGroup>
					<CommandSeparator />
					<CommandGroup heading="Settings">
						{accountPlan === 'pro' ? null : (
							<CommandItem onSelect={() => run(() => setPlan(plan === 'pro' ? 'free' : 'pro'))}>
								<SparklesIcon />
								{plan === 'pro' ? 'Back to the free plan' : 'Preview Pro'}
							</CommandItem>
						)}
						<CommandItem onSelect={() => run(toggleTheme)}>
							<MoonIcon />
							Toggle theme
						</CommandItem>
						<CommandItem
							value="spoiler free hide results"
							onSelect={() => run(() => spoilers.setFree(!spoilers.free))}
						>
							<EyeOffIcon />
							{spoilers.free ? 'Show results again' : 'Hide results (no spoilers)'}
						</CommandItem>
						{wakeLockSupported() ? (
							<CommandItem
								value="screen awake wake lock sleep"
								onSelect={() => run(() => keepAwakeStore.set(!keepAwake))}
							>
								<SunMediumIcon />
								{keepAwake ? 'Let the screen sleep' : 'Keep the screen awake while a race plays'}
							</CommandItem>
						) : null}
					</CommandGroup>
				</CommandList>
			</CommandDialog>
			<SessionPickerDialog open={picking} onOpenChange={setPicking} />
		</>
	);
}
