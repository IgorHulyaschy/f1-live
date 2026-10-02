import * as React from 'react';
import { useNavigate } from 'react-router';

import { useCarriedSearch } from '@/components/app-header';
import { useRace } from '@/data/race-context';
import { useDashboards } from '@/features/dashboard/dashboard-store';
import { dashboardPath } from '@/features/dashboard/paths';

function isTyping(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
	);
}

/** ← → step laps, Space plays, 1–9 switch dashboards, ⌘K or / opens the palette. */
export function useRaceHotkeys(openCommand: () => void): void {
	const { stepLap, playing, setPlaying } = useRace();
	const navigate = useNavigate();
	const search = useCarriedSearch();
	const { dashboards } = useDashboards();

	React.useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault();
				openCommand();

				return;
			}

			if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) {
				return;
			}

			// Leave keys alone while a menu or dialog is handling them.
			if (document.querySelector('[role="dialog"], [role="listbox"], [role="menu"]')) {
				return;
			}

			const page = /^[1-9]$/.test(event.key) ? dashboards[Number(event.key) - 1] : undefined;

			if (page) {
				void navigate({ pathname: dashboardPath(page.id), search });
			} else if (event.key === 'ArrowRight') {
				stepLap(1);
			} else if (event.key === 'ArrowLeft') {
				stepLap(-1);
			} else if (event.key === ' ' && !(event.target instanceof HTMLButtonElement)) {
				event.preventDefault();
				setPlaying(!playing);
			} else if (event.key === '/') {
				event.preventDefault();
				openCommand();
			}
		};

		window.addEventListener('keydown', onKeyDown);

		return () => window.removeEventListener('keydown', onKeyDown);
	}, [navigate, search, dashboards, stepLap, playing, setPlaying, openCommand]);
}
