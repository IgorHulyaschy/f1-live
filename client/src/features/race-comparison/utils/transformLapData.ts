import type { DataType, LapTimeUpdate } from '../types';

export function transformLapUpdate(lap: LapTimeUpdate, dataType: DataType): number {
	switch (dataType) {
		case 'lapTime':
			return lap.time;
		case 'sector1':
			return lap.sector1;
		case 'sector2':
			return lap.sector2;
		case 'sector3':
			return lap.sector3;
		default:
			return lap.time;
	}
}

export function formatTime(milliseconds: number): string {
	if (!milliseconds || milliseconds === 0) return '-';

	const totalSeconds = milliseconds / 1000;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = (totalSeconds % 60).toFixed(3);

	if (minutes > 0) {
		return `${minutes}:${seconds.padStart(6, '0')}`;
	}

	return `${seconds}s`;
}
