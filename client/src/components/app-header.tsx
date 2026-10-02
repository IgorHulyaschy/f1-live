import {
	MoonIcon,
	PauseIcon,
	PlayIcon,
	PlusIcon,
	SkipBackIcon,
	SkipForwardIcon,
	SunIcon
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { NavLink } from 'react-router';

import { Key, KeyGroup } from '@/components/console/keys';
import { Field, Kbd } from '@/components/console/panel';
import { LapStrip } from '@/components/lap-strip';
import { TRACK_STATUS_LABEL, TrackStatusBadge } from '@/components/track-status-badge';
import { useRace } from '@/data/race-context';
import { useDashboards } from '@/features/dashboard/dashboard-store';
import { useCreateDashboard } from '@/features/dashboard/dashboard-page';
import { dashboardPath } from '@/features/dashboard/paths';
import { useCarriedSearch } from '@/features/dashboard/use-carried-search';
import { toggleTheme, useDarkTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

const SESSION_LABEL = {
	race: 'Race',
	sprint: 'Sprint',
	qualifying: 'Qualifying',
	sprint_qualifying: 'Sprint Qualifying',
	practice: 'Practice'
} as const;

const PLAN_OPTIONS = [
	{ value: 'free', label: 'Free' },
	{ value: 'pro', label: 'Pro' }
] as const;

/** Two forward-cut bars: a pit board seen edge-on. The second takes the followed team's colour. */
function Wordmark() {
	return (
		<span className="flex items-center gap-2">
			<span aria-hidden className="flex gap-0.5">
				<span className="cut-forward bg-foreground h-4 w-3" />
				<span className="cut-forward bg-focus h-4 w-3" />
			</span>
			<span className="type-wide hidden text-sm font-black italic sm:inline">Pitwall</span>
		</span>
	);
}

/** Dashboards as tabs: presets first, then the viewer's own, then a key to start a new one. */
function MainNav() {
	const search = useCarriedSearch();
	const { dashboards } = useDashboards();
	const create = useCreateDashboard();

	return (
		<nav
			aria-label="Main"
			className="flex h-full min-w-0 items-stretch overflow-x-auto [scrollbar-width:none]"
		>
			{dashboards.map((dashboard) => (
				<NavLink
					key={dashboard.id}
					to={{ pathname: dashboardPath(dashboard.id), search }}
					end
					className={({ isActive }) =>
						cn(
							'type-wide relative flex shrink-0 items-center px-1.5 text-xs font-bold whitespace-nowrap transition-colors sm:px-3.5',
							isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
						)
					}
				>
					{({ isActive }) => (
						<>
							{dashboard.name || 'Untitled'}
							{isActive ? (
								<motion.span
									layoutId="nav-indicator"
									className="bg-focus absolute inset-x-1.5 -bottom-px h-0.75 sm:inset-x-3.5"
									transition={{ type: 'spring', stiffness: 600, damping: 45 }}
								/>
							) : null}
						</>
					)}
				</NavLink>
			))}
			<span className="flex shrink-0 items-center px-1.5">
				<Key aria-label="New dashboard" onClick={() => create()} className="h-7 px-1.5 sm:h-7">
					<PlusIcon />
				</Key>
			</span>
		</nav>
	);
}

function Transport() {
	const { race, lap, stepLap, playing, setPlaying } = useRace();
	const atEnd = lap >= race.currentLap;

	return (
		<div className="flex">
			<Key aria-label="Previous lap" disabled={lap <= 1} onClick={() => stepLap(-1)}>
				<SkipBackIcon />
			</Key>
			<Key
				aria-label={playing ? 'Pause replay' : 'Play replay'}
				disabled={atEnd}
				pressed={playing}
				onClick={() => setPlaying(!playing)}
				className="-ml-px"
			>
				{playing ? <PauseIcon /> : <PlayIcon />}
			</Key>
			<Key aria-label="Next lap" disabled={atEnd} onClick={() => stepLap(1)} className="-ml-px">
				<SkipForwardIcon />
			</Key>
		</div>
	);
}

/** A full-width marshal banner while the race is neutralised. */
function FlagBanner() {
	const { snapshot } = useRace();
	const status = snapshot.trackStatus;

	return (
		<AnimatePresence initial={false}>
			{status === 'green' ? null : (
				<motion.output
					key={status}
					initial={{ scaleX: 0 }}
					animate={{ scaleX: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.35, ease: 'easeOut' }}
					className={cn(
						'type-wide flex h-7 origin-left items-center justify-center text-xs font-black italic',
						status === 'red' ? 'bg-danger text-background' : 'bg-flag text-background'
					)}
				>
					{TRACK_STATUS_LABEL[status]}
				</motion.output>
			)}
		</AnimatePresence>
	);
}

export function AppHeader({ onOpenCommand }: { onOpenCommand: () => void }) {
	const { race, snapshot, lap, plan, setPlan, sourceKind } = useRace();
	const dark = useDarkTheme();
	const year = new Date(race.session.startsAt).getUTCFullYear();

	return (
		<>
			<header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur-sm">
				<div className="flex h-12 items-stretch gap-1 px-3 sm:gap-2 sm:px-4 md:gap-6 md:px-6">
					<NavLink to={{ pathname: '/' }} className="flex items-center" aria-label="Pitwall home">
						<Wordmark />
					</NavLink>
					<MainNav />
					<div className="ml-auto flex items-center gap-1 sm:gap-2">
						<Key
							onClick={onOpenCommand}
							aria-label="Search drivers, laps and pages"
							className="hidden sm:inline-flex"
						>
							<span className="hidden lg:inline">Jump</span>
							<Kbd className="border-0">⌘K</Kbd>
						</Key>
						<div className="hidden sm:block">
							<KeyGroup
								label="Plan preview"
								options={PLAN_OPTIONS}
								value={plan}
								onChange={setPlan}
							/>
						</div>
						<Key
							className="sm:hidden"
							pressed={plan === 'pro'}
							aria-label="Preview Pro"
							onClick={() => setPlan(plan === 'pro' ? 'free' : 'pro')}
						>
							Pro
						</Key>
						<Key
							onClick={toggleTheme}
							aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
							className="hidden sm:inline-flex"
						>
							{dark ? <SunIcon /> : <MoonIcon />}
						</Key>
					</div>
				</div>
				<FlagBanner />
			</header>
			<section aria-label="Session" className="flex flex-col gap-4 px-4 pt-6 pb-5 md:px-6">
				<div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
					<div className="flex min-w-0 flex-col gap-3">
						<h1 className="type-wide text-2xl leading-none font-black italic md:text-4xl">
							{race.session.meetingName.replace(/ Grand Prix$/, '')}
							<span className="text-muted-foreground"> GP {year}</span>
						</h1>
						<div className="flex flex-wrap gap-y-2 divide-x">
							<Field label="Circuit" className="pr-4">
								{race.session.circuit}
							</Field>
							<Field label="Session" className="px-4">
								{SESSION_LABEL[race.session.type]}
							</Field>
							<Field label="Feed" className="px-4">
								{sourceKind === 'mock' ? 'Replay' : 'Live'}
							</Field>
							<Field label="Track" className="pl-4">
								<TrackStatusBadge status={snapshot.trackStatus} />
							</Field>
						</div>
					</div>
					<div className="flex items-end gap-5">
						<Transport />
						<div className="flex items-baseline gap-2 leading-none" aria-live="polite">
							<span className="type-label">Lap</span>
							<span className="sr-only" data-testid="lap-counter">
								Lap {lap}/{race.session.totalLaps}
							</span>
							<span aria-hidden className="font-mono text-4xl font-bold">
								{String(lap).padStart(2, '0')}
							</span>
							<span aria-hidden className="text-muted-foreground font-mono text-lg">
								/{race.session.totalLaps}
							</span>
						</div>
					</div>
				</div>
				<LapStrip />
			</section>
		</>
	);
}
