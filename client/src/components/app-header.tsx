import {
	CalendarIcon,
	ChevronDownIcon,
	LayoutDashboardIcon,
	LibraryIcon,
	MoonIcon,
	PlusIcon,
	SunIcon,
	SwordsIcon,
	TrophyIcon
} from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import * as React from 'react';
import { NavLink, useLocation, useMatch, useNavigate } from 'react-router';

import { BRAND } from '@/brand';
import { Key, KeyGroup } from '@/components/console/keys';
import { Kbd } from '@/components/console/panel';
import { LiveStrip } from '@/components/live-strip';
import { TRACK_STATUS_LABEL } from '@/components/track-status-badge';
import { Wordmark } from '@/components/wordmark';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useRace } from '@/data/race-context';
import { useCreateDashboard } from '@/features/dashboard/use-add-dashboard';
import { useCarriedSearch } from '@/features/dashboard/use-carried-search';
import { useDashboardNav } from '@/features/dashboard/use-dashboard-nav';
import { AccountKey } from '@/features/account/account-menu';
import { useAccountPlan } from '@/features/account/account-store';
import { toggleTheme, useDarkTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

const PLAN_OPTIONS = [
	{ value: 'free', label: 'Free' },
	{ value: 'pro', label: 'Pro' }
] as const;

/** The season pages: calendar, standings and head-to-head, beside the dashboards. */
const SEASON_PAGES = [
	{ path: '/calendar', label: 'Calendar', icon: CalendarIcon },
	{ path: '/standings', label: 'Standings', icon: TrophyIcon },
	{ path: '/h2h', label: 'Head to head', icon: SwordsIcon }
] as const;

function SeasonMenu() {
	const navigate = useNavigate();
	const { pathname } = useLocation();

	const active =
		SEASON_PAGES.some((page) => page.path === pathname) || pathname.startsWith('/drivers/');

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label="Season: calendar, standings, head to head"
					className={cn(
						'type-label inline-flex h-7 items-center gap-1.5 border border-b-2 px-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-(--color-ring) 2xl:px-2.5 [&_svg]:size-3.5',
						active
							? 'border-foreground bg-foreground text-background'
							: 'hover:text-foreground hover:border-rule-strong'
					)}
					data-testid="season-menu"
				>
					<TrophyIcon aria-hidden />
					<span className="hidden 2xl:inline">Season</span>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-48">
				{SEASON_PAGES.map((page) => (
					<DropdownMenuItem key={page.path} onSelect={() => void navigate(page.path)}>
						<page.icon />
						{page.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * Dashboards as tabs: the session's own layout first, the ready-made ones that suit the session,
 * then the viewer's own. Every other ready-made dashboard is one click away under More.
 */
function MainNav() {
	const search = useCarriedSearch();
	const { tabs, more } = useDashboardNav();
	const create = useCreateDashboard();
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const moreActive = more.some((entry) => entry.path === pathname);
	const nav = React.useRef<HTMLElement>(null);

	// From a tablet up to a laptop the tabs scroll: the one on screen, or More, is kept in view.
	React.useEffect(() => {
		const links = [...(nav.current?.querySelectorAll('a') ?? [])];

		(
			links.find((link) => link.pathname === pathname) ??
			nav.current?.querySelector('[data-current]')
		)?.scrollIntoView({ block: 'nearest', inline: 'center' });
	}, [pathname]);

	return (
		<nav
			ref={nav}
			aria-label="Main"
			className="order-last flex w-full flex-wrap items-stretch pb-1 sm:order-none sm:h-full sm:w-auto sm:min-w-0 sm:flex-nowrap sm:overflow-x-auto sm:mask-r-from-90% sm:pb-0 sm:[scrollbar-width:none] lg:mask-none"
		>
			{tabs.map((entry) => (
				<NavLink
					key={entry.dashboard.id}
					to={{ pathname: entry.path, search }}
					end
					className={({ isActive }) =>
						cn(
							'type-wide relative flex h-8 shrink-0 items-center px-1.5 text-xs font-bold whitespace-nowrap transition-colors sm:h-auto sm:px-3.5',
							isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
						)
					}
				>
					{({ isActive }) => (
						<>
							{entry.label}
							{isActive ? <NavIndicator /> : null}
						</>
					)}
				</NavLink>
			))}
			{more.length > 0 ? (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className={cn(
								'type-wide relative flex h-8 shrink-0 items-center gap-1 px-1.5 text-xs font-bold whitespace-nowrap transition-colors outline-none focus-visible:underline sm:h-auto sm:px-3.5',
								moreActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
							)}
							data-current={moreActive || undefined}
						>
							More
							<ChevronDownIcon aria-hidden className="size-3.5" />
							{moreActive ? <NavIndicator /> : null}
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-56">
						<DropdownMenuLabel>
							<span className="type-label">Ready-made</span>
						</DropdownMenuLabel>
						{more.map((entry) => (
							<DropdownMenuItem
								key={entry.dashboard.id}
								onSelect={() => void navigate({ pathname: entry.path, search })}
							>
								<LayoutDashboardIcon />
								{entry.label}
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={() => void navigate({ pathname: '/library', search })}>
							<LibraryIcon />
							Library: fan dashboards
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			) : null}
			<span className="flex h-8 shrink-0 items-center gap-1 px-1.5 sm:h-auto">
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
				<SeasonMenu />
			</span>
		</nav>
	);
}

function NavIndicator() {
	return (
		<m.span
			layoutId="nav-indicator"
			className="bg-focus absolute inset-x-1.5 -bottom-px h-0.75 sm:inset-x-3.5"
			transition={{ type: 'spring', stiffness: 600, damping: 45 }}
		/>
	);
}

/** A full-width marshal banner while the race is neutralised. */
function FlagBanner() {
	const { snapshot } = useRace();
	const status = snapshot.trackStatus;

	return (
		<AnimatePresence initial={false}>
			{status === 'green' ? null : (
				<m.output
					key={status}
					initial={{ scaleX: 0 }}
					animate={{ scaleX: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.35, ease: 'easeOut' }}
					className={cn(
						'type-wide flex h-7 origin-left items-center justify-center text-xs font-black italic',
						status === 'red'
							? 'bg-danger text-background'
							: 'bg-flag text-foreground dark:text-background'
					)}
				>
					{TRACK_STATUS_LABEL[status]}
				</m.output>
			)}
		</AnimatePresence>
	);
}

export function AppHeader({ onOpenCommand }: { onOpenCommand: () => void }) {
	const { plan, setPlan } = useRace();
	const accountPlan = useAccountPlan();
	const dark = useDarkTheme();
	// The home has its own panel for the session on now; the strip is about the one on screen.
	const home = useMatch('/') !== null;

	return (
		<header className="bg-background/90 sticky top-0 z-40 mb-4 border-b backdrop-blur-sm">
			<div className="flex flex-wrap items-stretch gap-1 px-3 sm:h-12 sm:flex-nowrap sm:gap-2 sm:px-4 md:gap-6 md:px-6">
				<NavLink
					to={{ pathname: '/' }}
					className="flex h-10 items-center sm:h-auto"
					aria-label={`${BRAND.name} home`}
				>
					<Wordmark nameClassName="hidden sm:inline" />
				</NavLink>
				<MainNav />
				<div className="ml-auto flex h-10 items-center gap-1 sm:h-auto sm:gap-2">
					<Key
						onClick={onOpenCommand}
						aria-label="Search drivers, laps and pages"
						className="hidden sm:inline-flex"
					>
						<span className="hidden lg:inline">Jump</span>
						<Kbd className="border-0">⌘K</Kbd>
					</Key>
					{accountPlan === 'pro' ? null : (
						<>
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
						</>
					)}
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
			{home ? null : (
				<>
					<LiveStrip />
					<FlagBanner />
				</>
			)}
		</header>
	);
}
