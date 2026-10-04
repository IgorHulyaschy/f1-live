import type { TelemetryFetchStatus } from '@f1-live/shared';
import * as React from 'react';

import type { ArchiveFetches } from './archive-fetch.ts';

function noSubscription(): () => void {
	return () => undefined;
}

/** Where the server is with fetching the session's positions from the archive; null when it is not. */
export function useArchiveFetch(
	archive: ArchiveFetches | undefined,
	sessionKey: string
): TelemetryFetchStatus | null {
	const subscribe = React.useCallback(
		(listener: () => void) => archive?.subscribe(sessionKey, listener) ?? noSubscription(),
		[archive, sessionKey]
	);

	return React.useSyncExternalStore(subscribe, () => archive?.get(sessionKey) ?? null);
}
