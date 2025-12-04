import { useEffect } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { RACE_SESSION_QUERY_KEY } from './useRaceSession';

import { useWebSocket } from '@/hooks/useWebSocket';
import type { RaceSession } from '@/types/api.types';
import type {
	DriverUpdateData,
	LapUpdateData,
	PositionChangeData,
	SectorUpdateData,
	SessionUpdateData,
	StatusChangeData,
	TireChangeData,
	DRSUpdateData
} from '@/types/websocket.types';

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
export function useLiveRaceUpdates(options: UseLiveRaceUpdatesOptions = {}) {
	const { sessionId, enabled = true } = options;
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

		return subscribe<SessionUpdateData>('session_update', (data) => {
			queryClient.setQueryData<RaceSession>([RACE_SESSION_QUERY_KEY, sessionId], (old) => {
				if (!old) return old;

				return {
					...old,
					currentLap: data.currentLap,
					totalLaps: data.totalLaps,
					isLive: data.isLive
				};
			});
		});
	}, [isConnected, queryClient, sessionId, subscribe]);

	// Subscribe to driver updates
	useEffect(() => {
		if (!isConnected) return;

		return subscribe<DriverUpdateData>('driver_update', (data) => {
			queryClient.setQueryData<RaceSession>([RACE_SESSION_QUERY_KEY, sessionId], (old) => {
				if (!old) return old;

				const updatedDrivers = old.drivers.map((driver) =>
					driver.id === data.driver.id ? data.driver : driver
				);

				return {
					...old,
					drivers: updatedDrivers
				};
			});
		});
	}, [isConnected, queryClient, sessionId, subscribe]);

	// Subscribe to position changes
	useEffect(() => {
		if (!isConnected) return;

		return subscribe<PositionChangeData>('position_change', (data) => {
			queryClient.setQueryData<RaceSession>([RACE_SESSION_QUERY_KEY, sessionId], (old) => {
				if (!old) return old;

				const updatedDrivers = old.drivers.map((driver) => {
					if (driver.id === data.driverId) {
						return {
							...driver,
							position: data.newPosition,
							positionChange: data.positionChange
						};
					}

					return driver;
				});

				return {
					...old,
					drivers: updatedDrivers
				};
			});
		});
	}, [isConnected, queryClient, sessionId, subscribe]);

	// Subscribe to lap updates
	useEffect(() => {
		if (!isConnected) return;

		return subscribe<LapUpdateData>('lap_update', (data) => {
			queryClient.setQueryData<RaceSession>([RACE_SESSION_QUERY_KEY, sessionId], (old) => {
				if (!old) return old;

				const updatedDrivers = old.drivers.map((driver) => {
					if (driver.id === data.driverId) {
						return {
							...driver,
							lastLap: data.lapTime,
							hasFastestLap: data.isFastest,
							laps: data.lapNumber
						};
					}
					if (data.isFastest) {
						// Remove fastest lap from other drivers
						return {
							...driver,
							hasFastestLap: false
						};
					}

					return driver;
				});

				return {
					...old,
					drivers: updatedDrivers
				};
			});
		});
	}, [isConnected, queryClient, sessionId, subscribe]);

	// Subscribe to sector updates
	useEffect(() => {
		if (!isConnected) return;

		return subscribe<SectorUpdateData>('sector_update', (data) => {
			queryClient.setQueryData<RaceSession>([RACE_SESSION_QUERY_KEY, sessionId], (old) => {
				if (!old) return old;

				const sectorKey = `s${data.sector}` as 's1' | 's2' | 's3';
				const statusKey = `${sectorKey}Status` as 's1Status' | 's2Status' | 's3Status';

				const updatedDrivers = old.drivers.map((driver) => {
					if (driver.id === data.driverId) {
						return {
							...driver,
							[sectorKey]: data.time,
							[statusKey]: data.status
						};
					}

					return driver;
				});

				return {
					...old,
					drivers: updatedDrivers
				};
			});
		});
	}, [isConnected, queryClient, sessionId, subscribe]);

	// Subscribe to tire changes
	useEffect(() => {
		if (!isConnected) return;

		return subscribe<TireChangeData>('tire_change', (data) => {
			queryClient.setQueryData<RaceSession>([RACE_SESSION_QUERY_KEY, sessionId], (old) => {
				if (!old) return old;

				const updatedDrivers = old.drivers.map((driver) => {
					if (driver.id === data.driverId) {
						return {
							...driver,
							tire: data.tire,
							tireAge: data.tireAge
						};
					}

					return driver;
				});

				return {
					...old,
					drivers: updatedDrivers
				};
			});
		});
	}, [isConnected, queryClient, sessionId, subscribe]);

	// Subscribe to status changes
	useEffect(() => {
		if (!isConnected) return;

		return subscribe<StatusChangeData>('status_change', (data) => {
			queryClient.setQueryData<RaceSession>([RACE_SESSION_QUERY_KEY, sessionId], (old) => {
				if (!old) return old;

				const updatedDrivers = old.drivers.map((driver) => {
					if (driver.id === data.driverId) {
						return {
							...driver,
							status: data.status
						};
					}

					return driver;
				});

				return {
					...old,
					drivers: updatedDrivers
				};
			});
		});
	}, [isConnected, queryClient, sessionId, subscribe]);

	// Subscribe to DRS updates
	useEffect(() => {
		if (!isConnected) return;

		return subscribe<DRSUpdateData>('drs_update', (data) => {
			queryClient.setQueryData<RaceSession>([RACE_SESSION_QUERY_KEY, sessionId], (old) => {
				if (!old) return old;

				const updatedDrivers = old.drivers.map((driver) => {
					if (driver.id === data.driverId) {
						return {
							...driver,
							inDRS: data.inDRS
						};
					}

					return driver;
				});

				return {
					...old,
					drivers: updatedDrivers
				};
			});
		});
	}, [isConnected, queryClient, sessionId, subscribe]);

	return {
		status,
		isConnected
	};
}
