import { LibraryIcon, MoonIcon, PlusIcon, SunIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { NavLink } from 'react-router';

import { Key, KeyGroup } from '@/components/console/keys';
import { Kbd } from '@/components/console/panel';
import { LapCounter, Transport } from '@/components/race-clock';
import { TRACK_STATUS_LABEL } from '@/components/track-status-badge';
import { useRace } from '@/data/race-context';
import { useDashboards } from '@/features/dashboard/dashboard-store';
import { useCreateDashboard } from '@/features/dashboard/dashboard-page';
import { dashboardPath } from '@/features/dashboard/paths';
import { useCarriedSearch } from '@/features/dashboard/use-carried-search';
import { AccountKey } from '@/features/library/account';
import { useShownDashboard } from '@/features/library/shown-dashboard';
import { toggleTheme, useDarkTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

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
			className="flex h-full min-w-0 items-stretch overflow-x-auto mask-r-from-85% [scrollbar-width:none] sm:mask-none"
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
			<span className="flex shrink-0 items-center gap-1 px-1.5">
				<Key aria-label="New dashboard" onClick={() => create()} className="h-7 px-1.5 sm:h-7">
					<PlusIcon />
				</Key>
				<NavLink
					to={{ pathname: '/library', search }}
					aria-label="Library"
					className={({ isActive }) =>
						cn(
							'type-label inline-flex h-7 items-center gap-1.5 border border-b-2 px-1.5 transition-colors 2xl:px-2.5 [&_svg]:size-3.5',
							isActive
								? 'border-foreground bg-foreground text-background'
								: 'hover:text-foreground hover:border-rule-strong'
						)
					}
				>
					<LibraryIcon aria-hidden />
					<span className="hidden 2xl:inline">Library</span>
				</NavLink>
			</span>
		</nav>
	);
}

/**
 * Lap and transport in the bar itself, for pages whose dashboard has no Replay tile: the race can
 * always be moved, whatever a viewer took off their screen.
 */
function useNeedsClock(): boolean {
	const dashboard = useShownDashboard();

	return !dashboard?.tiles.some((tile) => tile.kind === 'replay');
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
	const { plan, setPlan } = useRace();
	const dark = useDarkTheme();
	const needsClock = useNeedsClock();

	return (
		<header className="bg-background/90 sticky top-0 z-40 mb-4 border-b backdrop-blur-sm">
			<div className="flex h-12 items-stretch gap-1 px-3 sm:gap-2 sm:px-4 md:gap-6 md:px-6">
				<NavLink to={{ pathname: '/' }} className="flex items-center" aria-label="Pitwall home">
					<Wordmark />
				</NavLink>
				<MainNav />
				<div className="ml-auto flex items-center gap-1 sm:gap-2">
					{needsClock ? (
						<div className="hidden items-center gap-3 sm:flex" data-testid="header-clock">
							<Transport className="hidden 2xl:flex" />
							<LapCounter size="sm" />
						</div>
					) : null}
					<Key
						onClick={onOpenCommand}
						aria-label="Search drivers, laps and pages"
						className="hidden sm:inline-flex"
					>
						<span className="hidden lg:inline">Jump</span>
						<Kbd className="border-0">⌘K</Kbd>
					</Key>
					<div className="hidden sm:block">
						<KeyGroup label="Plan preview" options={PLAN_OPTIONS} value={plan} onChange={setPlan} />
					</div>
					<Key
						className="sm:hidden"
						pressed={plan === 'pro'}
						aria-label="Preview Pro"
						onClick={() => setPlan(plan === 'pro' ? 'free' : 'pro')}
					>
						Pro
					</Key>
					<AccountKey className="hidden sm:inline-flex" />
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
	);
}
