import type { ChartDataPoint } from '../types';
import { useSessionData } from '@/features/simple-race-timing';

interface UseComparisonDataOptions {
	// chartId: string;
	driversNumbers: string[];
	// dataType: DataType;
	// enabled?: boolean;
}

interface UseComparisonDataReturn {
	data: ChartDataPoint[];
	isLoading: boolean;
	error: Error | null;
}

export function useComparisonData({
	driversNumbers
}: UseComparisonDataOptions): UseComparisonDataReturn {
	const { data, isLoading, error } = useSessionData({ enabled: false });

	// useLiveRaceUpdatesSimple();

	if (!data) {
		return {
			data: [],
			isLoading,
			error
		};
	}

	const filteredDataForDrivers = data.driversLapsData.filter((d) =>
		driversNumbers.includes(d.number)
	);

	const lapMap = new Map<number, ChartDataPoint>();

	filteredDataForDrivers.forEach((driver) => {
		driver.laps.forEach((lap) => {
			const existingLapData = lapMap.get(lap.lapNumber) || { lap: lap.lapNumber };

			existingLapData[driver.number] = lap.time;
			lapMap.set(lap.lapNumber, existingLapData);
		});
	});

	const formattedData = Array.from(lapMap.values()).sort((a, b) => a.lap - b.lap);

	return {
		data: formattedData,
		isLoading,
		error
	};
}
