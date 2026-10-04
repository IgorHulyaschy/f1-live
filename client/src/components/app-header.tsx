import {
	BellIcon,
	CalendarIcon,
	ChevronDownIcon,
	EllipsisIcon,
	LayoutDashboardIcon,
	LibraryIcon,
	LogOutIcon,
	MoonIcon,
	PlusIcon,
	SearchIcon,
	SparklesIcon,
	SunIcon,
	SwordsIcon,
	TrophyIcon,
	UserIcon
} from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import * as React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';

import { BRAND } from '@/brand';
import { Key } from '@/components/console/keys';
import { Kbd } from '@/components/console/panel';
import { LiveStrip } from '@/components/live-strip';
import { Wordmark } from '@/components/wordmark';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useRace } from '@/data/race-context';
import {
	DashboardEditBar,
	type DashboardTools,
	useDashboardTools
} from '@/features/dashboard/dashboard-menu';
import { useCreateDashboard } from '@/features/dashboard/use-add-dashboard';
import { useCarriedSearch } from '@/features/dashboard/use-carried-search';
import { useDashboardNav } from '@/features/dashboard/use-dashboard-nav';
import { signOutWithNotice } from '@/features/account/account-menu';
import { useAccount, useAccountPlan } from '@/features/account/account-store';
import { useGoPro } from '@/features/account/go-pro';
import { setLargerText, useLargerText } from '@/hooks/use-scale';
import { toggleTheme, useDarkTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import { useSessionOnScreen } from '@/platform/page-meta';

const SignInDialog = React.lazy(async () => ({
	default: (await import('@/features/account/sign-in')).SignInDialog
}));

/** The season pages: calendar, standings and head-to-head, beside the dashboards. */
const SEASON_PAGES = [
	{ path: '/calendar', label: 'Calendar', icon: CalendarIcon },
	{ path: '/standings', label: 'Standings', icon: TrophyIcon },
	{ path: '/h2h', label: 'Head to head', icon: SwordsIcon }
] as const;

/**
 * Dashboards as tabs on a laptop and up: the session's own layout first, the ready-made ones that
 * suit the session, then the viewer's own. Every other ready-made dashboard waits under More.
 */
function MainNav() {
	const search = useCarriedSearch();
	const { tabs, more } = useDashboardNav();
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const moreActive = more.some((entry) => entry.path === pathname);

	return (
		<nav
			aria-label="Main"
			className="flex h-full min-w-0 items-stretch overflow-hidden max-lg:hidden"
		>
			{tabs.map((entry) => (
				<NavLink
					key={entry.dashboard.id}
					to={{ pathname: entry.path, search }}
					end
					className={({ isActive }) =>
						cn(
							'type-wide relative flex shrink-0 items-center px-3 text-xs font-bold whitespace-nowrap transition-colors',
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
								'type-wide relative flex shrink-0 items-center gap-1 px-3 text-xs font-bold whitespace-nowrap transition-colors outline-none focus-visible:underline',
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
					</DropdownMenuContent>
				</DropdownMenu>
			) : null}
		</nav>
	);
}

/** Below a laptop the dashboards fold into one key naming the one on screen. */
function DashboardSwitcher() {
	const search = useCarriedSearch();
	const { tabs, more } = useDashboardNav();
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const current = [...tabs, ...more].find((entry) => entry.path === pathname);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Key
					className="min-w-0 shrink normal-case lg:hidden"
					aria-label={current ? `Dashboard: ${current.label}` : 'Dashboards'}
				>
					<span className="type-wide truncate font-bold">{current?.label ?? 'Dashboards'}</span>
					<ChevronDownIcon aria-hidden />
				</Key>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-56">
				{tabs.map((entry) => (
					<DropdownMenuItem
						key={entry.dashboard.id}
						onSelect={() => void navigate({ pathname: entry.path, search })}
					>
						<LayoutDashboardIcon />
						{entry.label}
					</DropdownMenuItem>
				))}
				{more.length > 0 ? (
					<>
						<DropdownMenuSeparator />
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
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function NavIndicator() {
	return (
		<m.span
			layoutId="nav-indicator"
			className="bg-focus absolute inset-x-3 -bottom-px h-0.75"
			transition={{ type: 'spring', stiffness: 600, damping: 45 }}
		/>
	);
}

/** While the race is neutralised, the bar's lower edge takes the flag's colour. */
function FlagBand() {
	const { snapshot } = useRace();
	const status = snapshot.trackStatus;

	return (
		<AnimatePresence initial={false}>
			{status === 'green' ? null : (
				<m.span
					key={status}
					aria-hidden
					initial={{ scaleX: 0 }}
					animate={{ scaleX: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.35, ease: 'easeOut' }}
					className={cn(
						'absolute inset-x-0 -bottom-px h-1 origin-left',
						status === 'red' ? 'bg-danger' : 'bg-flag'
					)}
				/>
			)}
		</AnimatePresence>
	);
}

/**
 * Everything used now and then, in one menu: the dashboard on screen, the library and season
 * pages, the theme and text size, the plan preview and the account.
 */
function AppMenu({ tools }: { tools: DashboardTools | null }) {
	const navigate = useNavigate();
	const search = useCarriedSearch();
	const create = useCreateDashboard();
	const { plan, setPlan } = useRace();
	const account = useAccount();
	const accountPlan = useAccountPlan();
	const goPro = useGoPro();
	const dark = useDarkTheme();
	const larger = useLargerText();
	const [signingIn, setSigningIn] = React.useState(false);
	const signedIn = account.status === 'signed-in' ? account.me : null;

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Key
						aria-label={signedIn ? `Menu, signed in as ${signedIn.user.email}` : 'Menu'}
						className="max-sm:px-2"
						data-app-menu
						data-testid="app-menu"
					>
						{signedIn ? <UserIcon /> : null}
						<EllipsisIcon />
					</Key>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-64">
					{tools ? (
						<>
							{tools.menuItems}
							<DropdownMenuSeparator />
						</>
					) : null}
					<DropdownMenuItem onSelect={() => create()}>
						<PlusIcon />
						New dashboard
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => void navigate({ pathname: '/library', search })}>
						<LibraryIcon />
						Library: fan dashboards
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => void navigate({ pathname: '/alerts', search })}>
						<BellIcon />
						Alerts: pushes and toasts
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					{SEASON_PAGES.map((page) => (
						<DropdownMenuItem key={page.path} onSelect={() => void navigate(page.path)}>
							<page.icon />
							{page.label}
						</DropdownMenuItem>
					))}
					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={toggleTheme}>
						{dark ? <SunIcon /> : <MoonIcon />}
						{dark ? 'Switch to light theme' : 'Switch to dark theme'}
					</DropdownMenuItem>
					<DropdownMenuCheckboxItem checked={larger} onCheckedChange={setLargerText}>
						Larger text
					</DropdownMenuCheckboxItem>
					{accountPlan === 'pro' ? null : (
						<DropdownMenuCheckboxItem
							checked={plan === 'pro'}
							onCheckedChange={(checked) => setPlan(checked ? 'pro' : 'free')}
						>
							Preview Pro
						</DropdownMenuCheckboxItem>
					)}
					<DropdownMenuSeparator />
					{signedIn ? (
						<>
							<DropdownMenuLabel>
								<span className="block truncate font-medium">{signedIn.user.email}</span>
								<span className="type-label block pt-0.5">
									{signedIn.plan === 'pro' ? 'Pro' : 'Free'}
								</span>
							</DropdownMenuLabel>
							<DropdownMenuItem onSelect={() => void navigate({ pathname: '/account', search })}>
								<UserIcon />
								Account and billing
							</DropdownMenuItem>
							{signedIn.plan === 'pro' ? null : (
								<DropdownMenuItem onSelect={goPro}>
									<SparklesIcon />
									Go Pro
								</DropdownMenuItem>
							)}
							<DropdownMenuItem onSelect={() => void signOutWithNotice()}>
								<LogOutIcon />
								Sign out
							</DropdownMenuItem>
						</>
					) : (
						<DropdownMenuItem
							disabled={account.status === 'loading'}
							onSelect={() => setSigningIn(true)}
						>
							<UserIcon />
							Sign in
						</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
			{signingIn ? (
				<React.Suspense fallback={null}>
					<SignInDialog open onOpenChange={setSigningIn} />
				</React.Suspense>
			) : null}
		</>
	);
}

/**
 * One slim bar over every page: home, the dashboards, the session on screen, Ask and a menu for
 * the rest. In edit mode the dashboards give way to the edit keys.
 */
export function AppHeader({ onOpenCommand }: { onOpenCommand: () => void }) {
	const tools = useDashboardTools();
	const editing = Boolean(tools?.editing);
	// The home has its own panel for the session on now; other pages without a session show none.
	const session = useSessionOnScreen();

	return (
		<header className="bg-background/90 sticky top-0 z-40 mb-4 h-[max(48px,2.5rem)] border-b backdrop-blur-sm">
			<div className="flex h-full items-center gap-2 px-3 sm:gap-3 sm:px-4 md:px-6 lg:gap-4">
				<NavLink
					to={{ pathname: '/' }}
					className="flex h-full shrink-0 items-center"
					aria-label={`${BRAND.name} home`}
				>
					<Wordmark nameClassName="hidden 2xl:inline" />
				</NavLink>
				{editing && tools ? (
					<DashboardEditBar tools={tools} />
				) : (
					<>
						<MainNav />
						<DashboardSwitcher />
					</>
				)}
				{session ? (
					<div
						className={cn(
							'ml-auto flex min-w-0 items-center max-sm:shrink-0',
							editing && 'max-lg:hidden'
						)}
					>
						<LiveStrip compact={editing} />
					</div>
				) : (
					<span className="ml-auto" />
				)}
				<Key
					onClick={onOpenCommand}
					aria-label="Ask about F1, or search drivers, races and pages"
					className="hidden sm:inline-flex"
				>
					<span className="hidden xl:inline">Ask</span>
					<Kbd className="border-0">⌘K</Kbd>
				</Key>
				<Key
					onClick={onOpenCommand}
					aria-label="Ask about F1, or search drivers, races and pages"
					className="max-sm:px-2 sm:hidden"
					data-testid="ask-button"
				>
					<SearchIcon />
				</Key>
				<AppMenu tools={tools} />
			</div>
			{session ? <FlagBand /> : null}
			{tools?.dialogs}
		</header>
	);
}
