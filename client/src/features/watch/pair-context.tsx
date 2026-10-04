import * as React from 'react';
import { useSearchParams } from 'react-router';

import { useRace } from '@/data/race-context';
import { sameItems, useStableValue } from '@/hooks/use-stable-value';
import { fights } from '@/insights/battle';
import { isTimedSession } from '@/insights/qualifying';
import { entryState } from '@/lib/history-entry';

/** Two drivers by number, the car ahead in the running order first. */
export type Pair = readonly [string, string];

type PairContextValue = {
	/** The two cars the duel compares: the picked pair, else the closest fight with pace to read. */
	pair: Pair | null;
	/** The pair the viewer chose, by a fight, the tower or the pickers; null while it is the default. */
	picked: Pair | null;
	/** The pair a fight row is pointed at, shown on the map and in the tower until it is left. */
	hovered: Pair | null;
	setPair: (pair: Pair) => void;
	/** Puts one driver in the duel against the one picked last, as a second tower row does. */
	pick: (driverNumber: string) => void;
	setHovered: (pair: Pair | null) => void;
};

const PairContext = React.createContext<PairContextValue | null>(null);

/**
 * The two drivers the race watching tiles compare. Fight rows, tower rows and the duel's own
 * pickers set it; it lives in the URL, by driver code like `compare`, so other windows and links
 * keep the same pair.
 */
export function PairProvider({ children }: { children: React.ReactNode }) {
	const { snapshot, standings, broadcast } = useRace();
	const [searchParams, setSearchParams] = useSearchParams();
	const [hovered, setHovered] = React.useState<Pair | null>(null);
	const raw = searchParams.get('duel');

	const picked = React.useMemo((): Pair | null => {
		const numbers = (raw ?? '')
			.split(',')
			.flatMap((code) => snapshot.drivers.find((driver) => driver.code === code)?.number ?? []);

		const [first, second] = numbers;

		return first && second && first !== second ? [first, second] : null;
	}, [raw, snapshot.drivers]);

	const timed = isTimedSession(snapshot.session.type);

	const closest = React.useMemo((): Pair | null => {
		if (picked || timed) {
			return null;
		}

		// A fight just after a stop has no laps to compare yet; the next one that has them says more.
		const list = fights(snapshot, standings);
		const top = list.find((fight) => fight.pace !== null) ?? list[0];
		const [first, second] = standings.filter((row) => row.state !== 'out');

		return top
			? [top.ahead.driver.number, top.behind.driver.number]
			: first && second
				? [first.driver.number, second.driver.number]
				: null;
	}, [picked, timed, snapshot, standings]);

	const position = (driverNumber: string) =>
		standings.find((row) => row.driver.number === driverNumber)?.position ?? Infinity;

	// Practice and qualifying have no fights: nothing is paired there.
	const chosen = timed ? null : (picked ?? closest);

	const ordered =
		chosen && position(chosen[1]) < position(chosen[0])
			? ([chosen[1], chosen[0]] as const)
			: chosen;

	// The same two cars keep one identity, so a new lap that changes nothing redraws nothing.
	const pair = useStableValue(ordered, (kept, next) =>
		kept === null || next === null ? kept === next : sameItems(kept, next)
	);

	const value = React.useMemo<PairContextValue>(() => {
		const setPair = (next: Pair) => {
			const codes = next
				.map((number) => snapshot.drivers.find((driver) => driver.number === number)?.code)
				.join(',');

			setSearchParams(
				(params) => {
					params.set('duel', codes);

					return params;
				},
				{ replace: true, state: entryState() }
			);
			broadcast({ duel: codes });
		};

		return {
			pair,
			picked,
			hovered,
			setPair,
			pick: (driverNumber) => {
				const kept = (picked ?? pair)?.at(-1);

				if (kept && kept !== driverNumber) {
					setPair([kept, driverNumber]);
				}
			},
			setHovered
		};
	}, [pair, picked, hovered, snapshot.drivers, setSearchParams, broadcast]);

	return <PairContext.Provider value={value}>{children}</PairContext.Provider>;
}

export function usePair(): PairContextValue {
	const context = React.useContext(PairContext);

	if (!context) {
		throw new Error('usePair must be used within <PairProvider>');
	}

	return context;
}

/** The cars to mark on the map and in the tower: the fight pointed at, else the duel's pair. */
export function usePairShown(): ReadonlySet<string> {
	const { pair, hovered } = usePair();
	const shown = hovered ?? pair;

	return React.useMemo(() => new Set(shown), [shown]);
}
