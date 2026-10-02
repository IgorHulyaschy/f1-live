import NumberFlow from '@number-flow/react';
import {
	MoonIcon,
	PauseIcon,
	PlayIcon,
	SearchIcon,
	SkipBackIcon,
	SkipForwardIcon,
	SunIcon
} from 'lucide-react';
import { motion } from 'motion/react';
import { NavLink, useSearchParams } from 'react-router';

import { Kbd } from '@/components/console/panel';
import { LapStrip } from '@/components/lap-strip';
import { TrackStatusBadge } from '@/components/track-status-badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useRace } from '@/data/race-context';
import { toggleTheme, useDarkTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

export const NAV_ITEMS = [
	{ to: '/', label: 'Live', shortcut: '1' },
	{ to: '/analysis', label: 'Analysis', shortcut: '2' },
	{ to: '/strategy', label: 'Strategy', shortcut: '3' }
] as const;

const SESSION_LABEL = {
	race: 'Race',
	sprint: 'Sprint',
	qualifying: 'Qualifying',
	sprint_qualifying: 'Sprint Qualifying',
	practice: 'Practice'
} as const;

function LogoMark() {
	return (
		<svg viewBox="0 0 24 24" className="text-primary size-6" aria-hidden>
			<path d="M3 18 9 6h12l-2 4h-7.5l-1 2H18l-2 4H8.5l-1 2Z" className="fill-current" />
		</svg>
	);
}

function MainNav() {
	const [searchParams] = useSearchParams();
	const search = searchParams.toString();

	return (
		<nav aria-label="Main" className="flex h-full items-stretch">
			{NAV_ITEMS.map((item) => (
				<NavLink
					key={item.to}
					to={{ pathname: item.to, search }}
					end
					className={({ isActive }) =>
						cn(
							'font-display relative flex items-center px-2 text-sm sm:px-3 font-semibold tracking-wider uppercase transition-colors',
							isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
						)
					}
				>
					{({ isActive }) => (
						<>
							{item.label}
							{isActive ? (
								<motion.span
									layoutId="nav-indicator"
									className="bg-primary absolute inset-x-2 -bottom-px sm:inset-x-3 h-0.5 rounded-full"
									transition={{ type: 'spring', stiffness: 500, damping: 40 }}
								/>
							) : null}
						</>
					)}
				</NavLink>
			))}
		</nav>
	);
}

function Transport() {
	const { race, lap, stepLap, playing, setPlaying } = useRace();
	const atEnd = lap >= race.currentLap;

	return (
		<div className="flex items-center">
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label="Previous lap"
				disabled={lap <= 1}
				onClick={() => stepLap(-1)}
			>
				<SkipBackIcon />
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label={playing ? 'Pause replay' : 'Play replay'}
				disabled={atEnd}
				onClick={() => setPlaying(!playing)}
			>
				{playing ? <PauseIcon /> : <PlayIcon />}
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label="Next lap"
				disabled={atEnd}
				onClick={() => stepLap(1)}
			>
				<SkipForwardIcon />
			</Button>
		</div>
	);
}

export function AppHeader({ onOpenCommand }: { onOpenCommand: () => void }) {
	const { race, snapshot, lap, plan, setPlan, sourceKind } = useRace();
	const dark = useDarkTheme();
	const year = new Date(race.session.startsAt).getUTCFullYear();
	const neutralised = snapshot.trackStatus !== 'green';

	return (
		<>
			<header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur-md">
				<div
					aria-hidden
					className={cn(
						'h-0.5 transition-colors duration-500',
						neutralised ? 'bg-safety-car' : 'bg-transparent'
					)}
				/>
				<div className="mx-auto flex h-12 max-w-screen-2xl items-stretch gap-1 px-3 sm:gap-2 sm:px-4 md:gap-6 md:px-6">
					<NavLink
						to={{ pathname: '/' }}
						className="flex items-center gap-1.5"
						aria-label="Pitwall home"
					>
						<LogoMark />
						<span className="font-display hidden text-lg font-bold tracking-wide uppercase sm:inline">
							Pitwall
						</span>
					</NavLink>
					<MainNav />
					<div className="ml-auto flex items-center gap-1 md:gap-3">
						<Button
							variant="outline"
							size="sm"
							onClick={onOpenCommand}
							aria-label="Search drivers, laps and pages"
						>
							<SearchIcon />
							<span className="text-muted-foreground hidden lg:inline">Jump to…</span>
							<Kbd className="hidden lg:inline-flex">⌘K</Kbd>
						</Button>
						<div className="flex items-center gap-2">
							<Switch
								id="pro-preview"
								checked={plan === 'pro'}
								onCheckedChange={(checked) => setPlan(checked ? 'pro' : 'free')}
							/>
							<Label htmlFor="pro-preview" className="sr-only sm:not-sr-only">
								<span className="font-display text-xs font-semibold tracking-wider uppercase">
									Pro
								</span>
							</Label>
						</div>
						<Button
							variant="ghost"
							size="icon-sm"
							onClick={toggleTheme}
							aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
						>
							{dark ? <SunIcon /> : <MoonIcon />}
						</Button>
					</div>
				</div>
			</header>
			<section
				aria-label="Session"
				className="mx-auto flex max-w-screen-2xl flex-col gap-4 px-4 pt-5 pb-4 md:px-6"
			>
				<div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
					<div className="flex min-w-0 flex-col gap-1">
						<span className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
							<span>{race.session.circuit}</span>
							<span aria-hidden>·</span>
							<span>{SESSION_LABEL[race.session.type]}</span>
							<span aria-hidden>·</span>
							{sourceKind === 'mock' ? (
								<span>Replay</span>
							) : (
								<span className="text-primary flex items-center gap-1.5 font-medium">
									<span className="bg-primary animate-live-dot size-1.5 rounded-full" />
									Live
								</span>
							)}
						</span>
						<h1 className="font-display text-2xl leading-none font-bold tracking-wide uppercase md:text-3xl">
							{race.session.meetingName}{' '}
							<span className="text-muted-foreground font-semibold">{year}</span>
						</h1>
					</div>
					<div className="flex items-center gap-4 md:gap-6">
						<TrackStatusBadge status={snapshot.trackStatus} />
						<Transport />
						<div
							className="font-display flex items-baseline gap-1.5 leading-none"
							aria-live="polite"
						>
							<span className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
								Lap
							</span>
							<span className="sr-only" data-testid="lap-counter">
								Lap {lap}/{race.session.totalLaps}
							</span>
							<span aria-hidden className="font-mono text-3xl font-semibold">
								<NumberFlow value={lap} />
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
