import { TyreBadge } from '@/components/tyre-badge';
import { useRace } from '@/data/race-context';
import { battleAhead } from '@/insights/battle';
import { standingsAt } from '@/insights/standings';

/**
 * The followed driver as a pit board, pinned to the bottom of the screen on phones so the one
 * car you care about is always in view, wherever you scroll.
 */
export function PitBoard() {
	const { snapshot, followedDriver, lap } = useRace();
	const row = standingsAt(snapshot).find((entry) => entry.driver.number === followedDriver);

	if (!row) {
		return null;
	}

	const ahead = battleAhead(snapshot, row.driver.number);

	return (
		<a
			href="#focus"
			aria-label={`Following ${row.driver.code}, P${row.position}. Show details.`}
			className="bg-background/95 border-rule-strong fixed inset-x-0 bottom-0 z-40 grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-t-2 px-4 py-2 backdrop-blur-sm md:hidden"
			style={{ '--team': `#${row.driver.teamColour}` }}
		>
			<span className="bg-team text-background cut-forward type-wide px-3 py-1 text-xl font-black italic">
				{row.state === 'out' ? 'OUT' : `P${row.position}`}
			</span>
			<span className="flex min-w-0 flex-col">
				<span className="type-wide text-sm font-bold">{row.driver.code}</span>
				<span className="text-muted-foreground truncate font-mono text-xs">
					{ahead ? `${ahead.intervalSeconds.toFixed(3)} to ${ahead.ahead.code}` : 'Clear ahead'}
				</span>
			</span>
			{row.compound ? <TyreBadge compound={row.compound} age={row.tyreAge} /> : <span />}
			<span className="font-mono text-xs">L{lap}</span>
		</a>
	);
}
