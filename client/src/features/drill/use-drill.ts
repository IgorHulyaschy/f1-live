import * as React from 'react';
import { useLocation, useNavigate, useNavigationType, useSearchParams } from 'react-router';

import { entryStateSchema } from '@/lib/history-entry';

import { DRILL_PARAMS, type DrillView, readDrill, writeDrill } from './drill-url';

/**
 * The address to come back to after Close steps back through history: the race as it is on
 * screen now, without the view. Close sets it; the return to the first entry applies it.
 */
let closingTo: URLSearchParams | null = null;

/** What had focus when the first view opened; it gets focus back when the last one closes. */
let opener: HTMLElement | null = null;

/** Puts focus back where it was before the views opened, if that is still on the page. */
export function returnFocusToOpener(): void {
	if (opener?.isConnected) {
		opener.focus();
	}

	opener = null;
}

export type Drill = {
	view: DrillView | null;
	/**
	 * Opens a view as a new history entry, so Back returns to what was open before. `replace`
	 * swaps the view at the same level instead, as stepping to the next lap does.
	 */
	open: (view: DrillView, options?: { replace?: boolean }) => void;
	/** Closes every level opened here; a view that came with the link just closes. */
	close: () => void;
};

export function useDrill(): Drill {
	const [searchParams] = useSearchParams();
	const location = useLocation();
	const navigate = useNavigate();
	const drillState = entryStateSchema.safeParse(location.state);
	const depth = drillState.success ? drillState.data.drillDepth : 0;
	const view = React.useMemo(() => readDrill(searchParams), [searchParams]);

	const open = React.useCallback(
		(next: DrillView, { replace = false }: { replace?: boolean } = {}) => {
			// The address bar is current even between renders, as the replay moves it.
			const current = new URLSearchParams(window.location.search);
			const params = writeDrill(current, next);

			if (params.toString() === current.toString()) {
				return;
			}

			if (readDrill(current) === null && document.activeElement instanceof HTMLElement) {
				opener = document.activeElement;
			}

			void navigate(
				{ search: params.toString() },
				replace && depth > 0
					? { replace: true, state: { drillDepth: depth } }
					: { state: { drillDepth: depth + 1 } }
			);
		},
		[navigate, depth]
	);

	const close = React.useCallback(() => {
		if (depth > 0) {
			closingTo = writeDrill(new URLSearchParams(window.location.search), null);
			void navigate(-depth);

			return;
		}

		const params = writeDrill(new URLSearchParams(window.location.search), null);

		void navigate({ search: params.toString() }, { replace: true });
	}, [navigate, depth]);

	return { view, open, close };
}

/**
 * Back and Forward between views keep the race where it is: the entry they return to holds the
 * replay position, the followed driver and the rest as they were when the view opened, so those
 * are put back to what was on screen and only the view changes.
 */
export function useKeepReplayOnBack(): void {
	const location = useLocation();
	const navigationType = useNavigationType();
	const navigate = useNavigate();
	const kept = React.useRef<URLSearchParams | null>(null);

	React.useEffect(() => {
		const params = new URLSearchParams(location.search);
		const previous = kept.current;

		const drillOf = (search: URLSearchParams) =>
			DRILL_PARAMS.map((name) => search.get(name) ?? '').join('/');

		kept.current = params;

		const closedTo = closingTo;

		closingTo = null;

		// A Back to another session is a deliberate step back to it; there is nothing to keep.
		if (
			navigationType !== 'POP' ||
			!previous ||
			drillOf(previous) === drillOf(params) ||
			(!closedTo && previous.get('session') !== params.get('session'))
		) {
			return;
		}

		// A Close knows the latest state; a Back reads the last one rendered.
		const restored = writeDrill(closedTo ?? previous, readDrill(params));

		if (restored.toString() !== params.toString()) {
			kept.current = restored;
			void navigate({ search: restored.toString() }, { replace: true, state: location.state });
		}
	}, [location, navigationType, navigate]);
}

/**
 * A view that came with the link opens over its session, as if opened there: the session gets an
 * entry of its own under the view, so Back and Close land on it instead of leaving the app.
 */
export function useLinkedViewOverSession(): void {
	const location = useLocation();
	const navigate = useNavigate();
	const [arrival] = React.useState(location);
	const done = React.useRef(false);

	React.useEffect(() => {
		const params = new URLSearchParams(arrival.search);

		if (
			done.current ||
			readDrill(params) === null ||
			entryStateSchema.safeParse(arrival.state).success
		) {
			return;
		}

		done.current = true;
		void navigate({ search: writeDrill(params, null).toString() }, { replace: true });
		void navigate({ search: params.toString() }, { state: { drillDepth: 1 } });
	}, [arrival, navigate]);
}
