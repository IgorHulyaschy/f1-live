import * as React from 'react';
import { useNavigate } from 'react-router';

import { useRace } from '@/data/race-context';
import { useCarriedSearch } from '@/features/dashboard/use-carried-search';
import { useDashboardNav } from '@/features/dashboard/use-dashboard-nav';
import { useEventJump } from '@/features/session/timeline';

function isTyping(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
	);
}

/**
 * ← → step laps, Shift with them jumps between events, Space plays, L goes back to live, 1–9
 * switch dashboards in the top bar's order, ⌘K or / opens the palette.
 */
export function useRaceHotkeys(openCommand: () => void): void {
	const { stepLap, playing, setPlaying, live } = useRace();
	const navigate = useNavigate();
	const search = useCarriedSearch();
	const { all: pages } = useDashboardNav();
	const jump = useEventJump();
	const jumpRef = React.useRef(jump);

	React.useEffect(() => {
		jumpRef.current = jump;
	});

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

			const page = /^[1-9]$/.test(event.key) ? pages[Number(event.key) - 1] : undefined;

			if (page) {
				void navigate({ pathname: page.path, search });
			} else if (event.shiftKey && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
				event.preventDefault();
				jumpRef.current(event.key === 'ArrowRight' ? 1 : -1);
			} else if (event.key === 'ArrowRight') {
				stepLap(1);
			} else if (event.key === 'ArrowLeft') {
				stepLap(-1);
			} else if (event.key.toLowerCase() === 'l' && live.isLive) {
				live.backToLive();
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
	}, [navigate, search, pages, stepLap, playing, setPlaying, openCommand, live]);
}
