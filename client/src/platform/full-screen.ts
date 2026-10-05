import * as React from 'react';

/** How the bar came back in full screen: the pointer at the top edge, or a key (no pointer needed). */
type BarReveal = 'pointer' | 'key' | null;

interface FullScreenState {
	active: boolean;
	reveal: BarReveal;
}

/** The pointer within this many pixels of the top edge brings the bar back. */
const EDGE_PX = 6;

let state: FullScreenState = { active: false, reveal: null };

const listeners = new Set<() => void>();

function set(next: FullScreenState) {
	if (next.active === state.active && next.reveal === state.reveal) {
		return;
	}

	state = next;

	for (const listener of listeners) {
		listener();
	}
}

function subscribe(listener: () => void) {
	listeners.add(listener);

	return () => listeners.delete(listener);
}

function read() {
	return state;
}

/** The page asks for the whole screen; a browser without the API (iPhone) gets the bare page. */
function canRequest(): boolean {
	return document.fullscreenEnabled;
}

export async function toggleFullScreen(): Promise<void> {
	if (state.active) {
		if (document.fullscreenElement) {
			await document.exitFullscreen().catch(() => undefined);
		}

		set({ active: false, reveal: null });

		return;
	}

	if (canRequest()) {
		try {
			await document.documentElement.requestFullscreen();
			set({ active: true, reveal: null });

			return;
		} catch {
			// Refused (no gesture, an iframe): the bare page below is the same view.
		}
	}

	set({ active: true, reveal: null });
}

/** Shows or hides the bar by key while in full screen. */
export function toggleBar(): void {
	if (state.active) {
		set({ active: true, reveal: state.reveal === 'key' ? null : 'key' });
	}
}

/**
 * Whether the page is in full screen, where the bar hides and the tiles take its place. Esc leaves
 * (the browser does it, or the key below when the browser has no full screen), the pointer at the
 * top edge or Tab into the bar brings it back, and so does the B key.
 */
export function useFullScreen(): FullScreenState {
	return React.useSyncExternalStore(subscribe, read);
}

/** Keeps the store in step with the browser, and the bar's reveal with the pointer. Mount once. */
export function useFullScreenEvents(bar: React.RefObject<HTMLElement | null>): void {
	const { active } = useFullScreen();

	React.useEffect(() => {
		const onChange = () => {
			set({ active: document.fullscreenElement !== null, reveal: null });
		};

		document.addEventListener('fullscreenchange', onChange);

		return () => document.removeEventListener('fullscreenchange', onChange);
	}, []);

	React.useEffect(() => {
		if (!active) {
			return;
		}

		const onMove = (event: PointerEvent) => {
			if (event.clientY <= EDGE_PX && state.reveal === null) {
				set({ active: true, reveal: 'pointer' });

				return;
			}

			const element = bar.current;

			if (
				state.reveal === 'pointer' &&
				element &&
				event.clientY > element.getBoundingClientRect().bottom + EDGE_PX &&
				!element.contains(document.activeElement) &&
				!element.querySelector('[aria-expanded="true"]')
			) {
				set({ active: true, reveal: null });
			}
		};

		const onKeyDown = (event: KeyboardEvent) => {
			// With a real full screen the browser takes Esc itself.
			if (
				event.key === 'Escape' &&
				!document.fullscreenElement &&
				!event.defaultPrevented &&
				!document.querySelector('[role="menu"]')
			) {
				set({ active: false, reveal: null });
			}
		};

		window.addEventListener('pointermove', onMove);
		window.addEventListener('keydown', onKeyDown);

		return () => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('keydown', onKeyDown);
		};
	}, [active, bar]);
}
