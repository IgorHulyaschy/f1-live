import type { Driver } from '@f1-live/shared';
import * as React from 'react';
import { useSearchParams } from 'react-router';

import { useRace } from '@/data/race-context';
import type { StandingRow } from '@/insights/standings';

const DEFAULT_COMPARED = 3;

type CompareContextValue = {
	/** Running cars, in race order. */
	running: readonly StandingRow[];
	/** Codes of the drivers on the charts. */
	selected: readonly string[];
	/** The selected drivers, in race order. */
	compared: readonly Driver[];
	toggle: (code: string) => void;
	highlighted: string | null;
	setHighlighted: (code: string | null) => void;
};

const CompareContext = React.createContext<CompareContextValue | null>(null);

/**
 * Which drivers the charts compare. Every chart and the compare list share it, so tiles on a
 * dashboard (and dashboards in other windows, through the URL) stay on the same cars.
 */
export function CompareProvider({ children }: { children: React.ReactNode }) {
	const { standings, followedDriver, broadcast } = useRace();
	const [searchParams, setSearchParams] = useSearchParams();
	const [highlighted, setHighlighted] = React.useState<string | null>(null);

	const running = React.useMemo(() => standings.filter((row) => row.state !== 'out'), [standings]);

	const raw = searchParams.get('compare');

	const selected = React.useMemo(() => {
		if (raw) {
			return raw.split(',').filter(Boolean);
		}

		const codes = running.slice(0, DEFAULT_COMPARED).map((row) => row.driver.code);
		const followed = running.find((row) => row.driver.number === followedDriver)?.driver.code;

		return followed && !codes.includes(followed) ? [...codes, followed] : codes;
	}, [raw, running, followedDriver]);

	const value = React.useMemo<CompareContextValue>(
		() => ({
			running,
			selected,
			compared: running.map((row) => row.driver).filter((driver) => selected.includes(driver.code)),
			toggle: (code) => {
				const next = selected.includes(code)
					? selected.length > 1
						? selected.filter((entry) => entry !== code)
						: selected
					: [...selected, code];

				setSearchParams(
					(params) => {
						params.set('compare', next.join(','));

						return params;
					},
					{ replace: true }
				);
				broadcast({ compare: next.join(',') });
			},
			highlighted,
			setHighlighted
		}),
		[running, selected, highlighted, setSearchParams, broadcast]
	);

	return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare(): CompareContextValue {
	const context = React.useContext(CompareContext);

	if (!context) {
		throw new Error('useCompare must be used within <CompareProvider>');
	}

	return context;
}
