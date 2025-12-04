import type { DriverStatus } from '../types';

/**
 * Get status label text
 */
export const getStatusLabel = (status: DriverStatus): string => {
	switch (status) {
		case 'PIT':
			return 'PIT';
		case 'OUT':
			return 'OUT LAP';
		case 'TRACK':
		default:
			return 'ON TRACK';
	}
};
