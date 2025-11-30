import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { RestInfo } from '../types/real-data-we-have.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://4f2be24f08fd.ngrok-free.app';

/**
 * Fetch session data from API
 */
async function fetchSessionData(): Promise<RestInfo> {
	const response = await fetch(`${API_BASE_URL}/onLoad`, {
		headers: {
			'ngrok-skip-browser-warning': 'true'
		}
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	return response.json();
}

interface UseSessionDataOptions {
	enabled?: boolean;
	refetchInterval?: number | false;
}

/**
 * Hook to fetch real session data
 *
 * @param options - Configuration options
 * @param options.enabled - Whether the query should run (default: true)
 * @param options.refetchInterval - Auto-refetch interval in ms (default: false)
 *
 * @example
 * const { data, isLoading, error } = useSessionData({
 *   refetchInterval: 5000  // Refresh every 5 seconds
 * });
 */
export function useSessionData({
	enabled = true,
	refetchInterval = false
}: UseSessionDataOptions = {}): UseQueryResult<RestInfo, Error> {
	return useQuery({
		queryKey: ['session-data'],
		queryFn: fetchSessionData,
		enabled,
		refetchInterval,
		staleTime: 1000 * 5 // 5 seconds
	});
}
