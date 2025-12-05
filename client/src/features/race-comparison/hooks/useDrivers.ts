import { useSessionData } from '@/features/simple-race-timing';
import type { Driver } from '@f1-live/shared';

export function useDrivers(): {
	data: Driver[];
	isLoading: boolean;
	error: Error | null;
} {
	const { data, isLoading, error } = useSessionData();

	if (!data) {
		return {
			data: [],
			isLoading,
			error
		};
	}

	return {
		data: data.driversLapsData,
		isLoading,
		error
	};
}
