import {
	ChartLineIcon,
	FlagIcon,
	GaugeIcon,
	LayersIcon,
	MoonIcon,
	SkipBackIcon,
	SkipForwardIcon,
	SparklesIcon
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';

import { NAV_ITEMS } from '@/components/app-header';
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
import { useRace } from '@/data/race-context';
import { toggleTheme } from '@/hooks/use-theme';
import { standingsAt } from '@/insights/standings';

const PAGE_ICON = { '/': GaugeIcon, '/analysis': ChartLineIcon, '/strategy': LayersIcon } as const;

/** ⌘K: follow any driver, jump to a page or lap, or flip settings without hunting for controls. */
export function CommandMenu({
	open,
	onOpenChange
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { race, snapshot, setLap, plan, setPlan, followedDriver, setFollowedDriver } = useRace();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const rows = standingsAt(snapshot);

	const run = (action: () => void) => {
		action();
		onOpenChange(false);
	};

	const neutralisedLaps = [
		...new Set(race.laps.filter((lap) => lap.trackStatus !== 'green').map((lap) => lap.lap))
	];

	return (
		<CommandDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Jump to"
			description="Follow a driver, open a page or move through the race."
		>
			<CommandInput placeholder="Driver, page or lap…" />
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
									: row.state === 'out'
										? 'Out'
										: `P${row.position}`}
							</CommandShortcut>
						</CommandItem>
					))}
				</CommandGroup>
				<CommandSeparator />
				<CommandGroup heading="Pages">
					{NAV_ITEMS.map((item) => {
						const Icon = PAGE_ICON[item.to];

						return (
							<CommandItem
								key={item.to}
								onSelect={() =>
									run(() => navigate({ pathname: item.to, search: searchParams.toString() }))
								}
							>
								<Icon />
								{item.label}
								<CommandShortcut>{item.shortcut}</CommandShortcut>
							</CommandItem>
						);
					})}
				</CommandGroup>
				<CommandSeparator />
				<CommandGroup heading="Race">
					<CommandItem onSelect={() => run(() => setLap(1))}>
						<SkipBackIcon />
						Start of the race
					</CommandItem>
					<CommandItem onSelect={() => run(() => setLap(race.currentLap))}>
						<SkipForwardIcon />
						Latest lap
					</CommandItem>
					{neutralisedLaps.map((lap) => (
						<CommandItem
							key={lap}
							value={`lap ${lap} vsc neutralised`}
							onSelect={() => run(() => setLap(lap))}
						>
							<FlagIcon />
							Lap {lap}: neutralised
						</CommandItem>
					))}
				</CommandGroup>
				<CommandSeparator />
				<CommandGroup heading="Settings">
					<CommandItem onSelect={() => run(() => setPlan(plan === 'pro' ? 'free' : 'pro'))}>
						<SparklesIcon />
						{plan === 'pro' ? 'Back to the free plan' : 'Preview Pro'}
					</CommandItem>
					<CommandItem onSelect={() => run(toggleTheme)}>
						<MoonIcon />
						Toggle theme
					</CommandItem>
				</CommandGroup>
			</CommandList>
		</CommandDialog>
	);
}
