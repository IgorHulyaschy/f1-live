import * as React from 'react';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { SessionPickerDialog } from '@/features/session/session-picker';

import {
	returnFocusToOpener,
	useDrill,
	useKeepReplayOnBack,
	useLinkedViewOverSession
} from './use-drill';

const loadDrillContent = () => import('./drill-content');

const DrillContent = React.lazy(async () => ({ default: (await loadDrillContent()).DrillContent }));

/**
 * The views carry charts and tables the first screen never shows, so they stay out of it and load
 * a second after the page has; by the time anyone opens a driver they are there.
 */
function prefetchAfterLoad(): () => void {
	let timer = 0;

	const later = () => {
		timer = window.setTimeout(() => void loadDrillContent(), 1000);
	};

	if (document.readyState === 'complete') {
		later();
	} else {
		window.addEventListener('load', later, { once: true });
	}

	return () => {
		window.removeEventListener('load', later);
		window.clearTimeout(timer);
	};
}

/**
 * The driver, lap and compare views: a side sheet beside the dashboard on wide screens, a full
 * page on phones. It is not modal, so a click on another driver in the timing or on the map
 * opens theirs; Escape, Back and the close key shut it.
 */
export function DrillSheet() {
	const { view, close } = useDrill();
	const [picking, setPicking] = React.useState(false);

	useKeepReplayOnBack();
	useLinkedViewOverSession();

	React.useEffect(prefetchAfterLoad, []);

	const open = view !== null;

	React.useEffect(() => {
		if (!open) {
			returnFocusToOpener();
		}
	}, [open]);

	return (
		<>
			<Sheet
				open={view !== null}
				modal={false}
				onOpenChange={(next) => {
					if (!next) {
						close();
					}
				}}
			>
				{view ? (
					<SheetContent
						data-testid="drill-sheet"
						data-drill-sheet
						className="sm:max-w-xl 2xl:max-w-3xl"
						// Outside clicks belong to the dashboard: a row or a car there opens its own view.
						onInteractOutside={(event) => event.preventDefault()}
					>
						<React.Suspense
							fallback={
								<SheetTitle asChild>
									<p className="type-label p-4">Loading</p>
								</SheetTitle>
							}
						>
							<DrillContent view={view} onPickSession={() => setPicking(true)} />
						</React.Suspense>
					</SheetContent>
				) : null}
			</Sheet>
			<SessionPickerDialog open={picking} onOpenChange={setPicking} />
		</>
	);
}
