import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiService } from '@/api/client';
import type { RaceSession } from '@/types/api.types';

export const RACE_SESSION_QUERY_KEY = 'race-session';

interface UseRaceSessionOptions {
	sessionId?: string;
	enabled?: boolean;
	refetchInterval?: number | false;
}

/**
 * Hook to fetch race session data
 *
 * @param options - Configuration options
 * @param options.sessionId - Optional session ID. If not provided, fetches current session
 * @param options.enabled - Whether the query should run (default: true)
 * @param options.refetchInterval - Auto-refetch interval in ms (default: 5000ms for live data)
 *
 * @example
 * // Fetch current session with auto-refresh
 * const { data, isLoading, error } = useRaceSession({ refetchInterval: 5000 });
 *
 * @example
 * // Fetch specific session
 * const { data } = useRaceSession({ sessionId: 'session-123' });
 */
export function useRaceSession({
	sessionId,
	enabled = true,
	refetchInterval = 5000
}: UseRaceSessionOptions = {}): UseQueryResult<RaceSession, Error> {
	return useQuery({
		queryKey: [RACE_SESSION_QUERY_KEY, sessionId],
		queryFn: () => apiService.getRaceSession(sessionId),
		enabled,
		refetchInterval: (query) => {
			// Only auto-refetch if session is live
			const isLive = query.state.data?.isLive;

			return isLive ? refetchInterval : false;
		},
		staleTime: 1000 * 5 // 5 seconds
	});
}
