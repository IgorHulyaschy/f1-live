import { useEffect } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import type { Lap, RestInfo } from '../types';
import { useWebSocket } from '@/hooks/useWebSocket';

interface UseLiveRaceUpdatesOptions {
	sessionId?: string;
	enabled?: boolean;
}

/**
 * Hook to receive live race updates via WebSocket and update TanStack Query cache
 *
 * @param options - Configuration options
 * @param options.sessionId - Session ID to subscribe to updates for
 * @param options.enabled - Whether to enable WebSocket connection (default: true)
 *
 * @example
 * const { status } = useLiveRaceUpdates({ sessionId: 'race-2024' });
 */
export function useLiveRaceUpdatesSimple(options: UseLiveRaceUpdatesOptions = {}) {
	const { enabled = true } = options;
	const queryClient = useQueryClient();

	const { status, subscribe, isConnected } = useWebSocket({
		enabled,
		onConnect: () => {
			// eslint-disable-next-line no-console
			console.log('WebSocket connected - listening for live updates');
		},
		onDisconnect: () => {
			// eslint-disable-next-line no-console
			console.log('WebSocket disconnected');
		}
	});

	// Subscribe to session updates
	useEffect(() => {
		if (!isConnected) return;

		return subscribe<Lap>('LapInfo', (lap) => {
			queryClient.setQueryData<RestInfo>(['session-data'], (old) => {
				if (!old) return old;

				return {
					...old,
					driversLapsData: old.driversLapsData.map((driver) => {
						if (driver.number !== lap.driverNumber) return driver;

						const lapExists = driver.laps.some((l) => l.id === lap.id);

						return {
							...driver,
							laps: lapExists
								? driver.laps.map((l) => (l.id === lap.id ? lap : l))
								: [lap, ...driver.laps]
						};
					})
				};
			});
		});
	}, [isConnected, queryClient, subscribe]);

	return {
		status,
		isConnected
	};
}
