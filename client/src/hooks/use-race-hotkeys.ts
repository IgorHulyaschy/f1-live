import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { NAV_ITEMS } from '@/components/app-header';
import { useRace } from '@/data/race-context';

function isTyping(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
	);
}

/** ← → step laps, Space plays, 1–3 switch pages, ⌘K or / opens the palette. */
export function useRaceHotkeys(openCommand: () => void): void {
	const { stepLap, playing, setPlaying } = useRace();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const search = searchParams.toString();

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

			const page = NAV_ITEMS.find((item) => item.shortcut === event.key);

			if (page) {
				navigate({ pathname: page.to, search });
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
	}, [navigate, search, stepLap, playing, setPlaying, openCommand]);
}
