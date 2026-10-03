import { useNavigate, useSearchParams } from 'react-router';

import { TyreBadge } from '@/components/tyre-badge';
import { useCarriedSearch } from '@/features/dashboard/use-carried-search';
import { useRace } from '@/data/race-context';
import { battleAhead } from '@/insights/battle';
import { OUT_LABEL } from '@/insights/standings';

/**
 * The followed driver as a pit board, pinned to the bottom of the screen on phones so the one
 * car you care about is always in view, wherever you scroll.
 */
export function PitBoard() {
	const { snapshot, followedDriver, lap, standings } = useRace();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const search = useCarriedSearch();
	const row = standings.find((entry) => entry.driver.number === followedDriver);

	// Edit mode needs the whole screen, and the board would sit over the tile controls.
	if (!row || searchParams.get('edit') === '1') {
		return null;
	}

	const ahead = battleAhead(snapshot, row.driver.number);

	// Scroll to this dashboard's focus panel or the driver's row in the tower, or open the
	// session's layout, which always has the tower.
	const showFocus = () => {
		const panel =
			document.querySelector('[data-focus-panel]') ??
			document.querySelector(`[data-testid="timing-row-${CSS.escape(row.driver.code)}"]`);

		if (panel) {
			panel.scrollIntoView({ behavior: 'smooth', block: 'center' });

			return;
		}

		void navigate({ pathname: '/', search });
	};

	return (
		<button
			type="button"
			data-pit-board
			onClick={showFocus}
			aria-label={`Following ${row.driver.code}, P${row.position}. Show details.`}
			className="bg-background/95 text-left border-rule-strong fixed inset-x-0 bottom-0 z-40 grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-t-2 px-4 py-2 backdrop-blur-sm md:hidden"
			style={{ '--team': `#${row.driver.teamColour}` }}
		>
			<span className="bg-team text-background cut-forward type-wide px-3 py-1 text-xl font-black italic">
				{row.out ? OUT_LABEL[row.out] : `P${row.position}`}
			</span>
			<span className="flex min-w-0 flex-col">
				<span className="type-wide text-sm font-bold">{row.driver.code}</span>
				<span className="text-muted-foreground truncate font-mono text-xs">
					{ahead ? `${ahead.intervalSeconds.toFixed(3)} to ${ahead.ahead.code}` : 'Clear ahead'}
				</span>
			</span>
			{row.compound ? <TyreBadge compound={row.compound} age={row.tyreAge} /> : <span />}
			<span className="font-mono text-xs">L{lap}</span>
		</button>
	);
}
