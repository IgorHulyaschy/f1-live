import * as React from 'react';
import { z } from 'zod';

import { createLocalStore } from '@/lib/local-store';

/** The viewer's setting: on by default, so a phone on the sofa does not sleep mid-race. */
export const keepAwakeStore = createLocalStore('pitwall-keep-awake', z.boolean(), true);

export function wakeLockSupported(): boolean {
	return 'wakeLock' in navigator;
}

/**
 * Holds a screen wake lock while `active`. The browser drops the lock whenever the tab is hidden,
 * so it is taken again each time the page becomes visible.
 */
export function useScreenWakeLock(active: boolean): void {
	React.useEffect(() => {
		if (!active || !wakeLockSupported()) {
			return;
		}

		let sentinel: WakeLockSentinel | null = null;
		let released = false;

		const acquire = async () => {
			if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) {
				return;
			}

			try {
				const lock = await navigator.wakeLock.request('screen');

				if (released) {
					await lock.release();
				} else {
					sentinel = lock;
				}
			} catch {
				// Refused by battery saver or a permissions policy: the screen keeps its own timeout.
			}
		};

		const onVisibilityChange = () => void acquire();

		void acquire();
		document.addEventListener('visibilitychange', onVisibilityChange);

		return () => {
			released = true;
			document.removeEventListener('visibilitychange', onVisibilityChange);
			void sentinel?.release();
		};
	}, [active]);
}
