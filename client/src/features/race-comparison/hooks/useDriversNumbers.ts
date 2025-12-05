import { useSessionData } from '@/features/simple-race-timing';
import type { Driver } from '@f1-live/shared';

export function useDriversNumbers(): {
	data: Driver['number'][];
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
		data: data.driversLapsData.map((d) => d.number),
		isLoading,
		error
	};
}
