import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiService } from '../services/api';

import type { SessionInfo } from '../types/api.types';

export const SESSIONS_QUERY_KEY = 'sessions';

interface UseSessionsOptions {
	enabled?: boolean;
}

/**
 * Hook to fetch list of available sessions
 *
 * @param options - Configuration options
 * @param options.enabled - Whether the query should run (default: true)
 *
 * @example
 * const { data: sessions, isLoading } = useSessions();
 */
export function useSessions({ enabled = true }: UseSessionsOptions = {}): UseQueryResult<
	SessionInfo[],
	Error
> {
	return useQuery({
		queryKey: [SESSIONS_QUERY_KEY],
		queryFn: () => apiService.getSessions(),
		enabled,
		staleTime: 1000 * 60 // 1 minute
	});
}
