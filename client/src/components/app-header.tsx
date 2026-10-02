import { MoonIcon, SunIcon } from 'lucide-react';
import * as React from 'react';
import { NavLink, useSearchParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useRace } from '@/data/race-context';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
	{ to: '/', label: 'Live' },
	{ to: '/analysis', label: 'Analysis' },
	{ to: '/strategy', label: 'Strategy' }
] as const;

function useTheme() {
	const [dark, setDark] = React.useState(() => document.documentElement.classList.contains('dark'));

	React.useEffect(() => {
		document.documentElement.classList.toggle('dark', dark);
	}, [dark]);

	return { dark, toggle: () => setDark((value) => !value) };
}

export function AppHeader() {
	const { plan, setPlan } = useRace();
	const [searchParams] = useSearchParams();
	const theme = useTheme();
	const search = searchParams.toString();

	return (
		<header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur">
			<div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-4 px-4 md:px-6">
				<NavLink to={{ pathname: '/', search }} className="flex items-center gap-2 font-semibold">
					<span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-xs font-bold">
						PW
					</span>
					<span className="hidden sm:inline">Pitwall</span>
				</NavLink>
				<nav aria-label="Main" className="flex items-center gap-1">
					{NAV_ITEMS.map((item) => (
						<NavLink
							key={item.to}
							to={{ pathname: item.to, search }}
							end
							className={({ isActive }) =>
								cn(
									'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
									isActive
										? 'bg-secondary text-secondary-foreground'
										: 'text-muted-foreground hover:text-foreground'
								)
							}
						>
							{item.label}
						</NavLink>
					))}
				</nav>
				<div className="ml-auto flex items-center gap-3">
					<div className="flex items-center gap-2">
						<Switch
							id="pro-preview"
							checked={plan === 'pro'}
							onCheckedChange={(checked) => setPlan(checked ? 'pro' : 'free')}
						/>
						<Label htmlFor="pro-preview">
							<span className="text-muted-foreground">Pro</span>
						</Label>
					</div>
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={theme.toggle}
						aria-label={theme.dark ? 'Switch to light theme' : 'Switch to dark theme'}
					>
						{theme.dark ? <SunIcon /> : <MoonIcon />}
					</Button>
				</div>
			</div>
		</header>
	);
}
