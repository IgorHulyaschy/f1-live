import type { ResultDriver, SeasonResults, SessionResults } from '@f1-live/shared/results';
import { EyeOffIcon } from 'lucide-react';
import * as React from 'react';
import { useSearchParams } from 'react-router';

import { Key } from '@/components/console/keys';
import { useRace } from '@/data/race-context';
import { heldFromHistory } from '@/data/spoilers';
import { revealSession, useSpoilerSettings } from '@/data/viewer-settings';
import { useNow } from '@/hooks/use-now';

/** The seasons the catalog lists, oldest first. */
export function useYears(): number[] {
	const { catalog } = useRace();

	return React.useMemo(() => catalog?.seasons.map((season) => season.year) ?? [], [catalog]);
}

/** Sets or clears search parameters in place, without a history entry. */
export function useSearchUpdate(): (changes: Readonly<Record<string, string | null>>) => void {
	const [, setParams] = useSearchParams();

	return React.useCallback(
		(changes) =>
			setParams(
				(current) => {
					const next = new URLSearchParams(current);

					for (const [name, value] of Object.entries(changes)) {
						if (value === null) {
							next.delete(name);
						} else {
							next.set(name, value);
						}
					}

					return next;
				},
				{ replace: true }
			),
		[setParams]
	);
}

/** Whether a session's result may count on the history pages (`heldFromHistory`). */
export function useHistoryFilter(): (session: SessionResults) => boolean {
	const settings = useSpoilerSettings();
	const now = useNow();

	return React.useCallback(
		(session) => !heldFromHistory(settings, String(session.key), session.startsAt, now),
		[settings, now]
	);
}

/** The keys of the sessions that count, as the shared standings take them. */
export function includedKeys(
	seasons: readonly SeasonResults[],
	counts: (session: SessionResults) => boolean
): (key: number) => boolean {
	const held = new Set(
		seasons.flatMap((season) =>
			season.rounds.flatMap((round) =>
				round.sessions.filter((session) => !counts(session)).map((session) => session.key)
			)
		)
	);

	return (key) => !held.has(key);
}

/** A driver as the newest season that has them names them. */
export function driverInfo(seasons: readonly SeasonResults[], id: string): ResultDriver | null {
	return seasons.findLast((season) => season.drivers[id])?.drivers[id] ?? null;
}

export function driverName(driver: ResultDriver | null, id: string): string {
	return driver ? `${driver.firstName} ${driver.lastName}` : id;
}

/** "N sessions hidden" with a key that reveals them, where a view leaves sessions out. */
export function HiddenNote({ sessions }: { sessions: readonly SessionResults[] }) {
	if (sessions.length === 0) {
		return null;
	}

	return (
		<p
			className="hatch flex flex-wrap items-center gap-x-3 gap-y-1 border px-3 py-2 text-sm"
			data-testid="hidden-note"
		>
			<EyeOffIcon aria-hidden className="size-4 shrink-0" />
			<span>
				{sessions.length === 1 ? '1 session' : `${sessions.length} sessions`} hidden: results you
				have not seen yet are left out.
			</span>
			<Key
				className="ml-auto"
				onClick={() => {
					for (const session of sessions) {
						revealSession(String(session.key));
					}
				}}
			>
				Reveal to include
			</Key>
		</p>
	);
}

/** The page's title block, as the library prints it. */
export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
	return (
		<header className="flex flex-col gap-2">
			<h1 className="type-wide text-2xl leading-none font-black italic md:text-4xl">{title}</h1>
			{children ? <p className="text-muted-foreground max-w-2xl text-sm">{children}</p> : null}
		</header>
	);
}
