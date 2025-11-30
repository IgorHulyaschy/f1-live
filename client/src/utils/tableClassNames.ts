import classNames from 'classnames';

import type { DriverStatus, SectorStatus, TireCompound } from '../types/driver.types';

/**
 * Get classes for position number display
 */
export const getPositionClasses = (position: number) =>
	classNames('font-mono font-bold text-[15px] text-center', {
		'text-[#ffd700]': position === 1, // Gold
		'text-[#c0c0c0]': position === 2, // Silver
		'text-[#cd7f32]': position === 3 // Bronze
	});

/**
 * Get classes for table row based on position change
 */
export const getRowClasses = (positionChange: number) =>
	classNames(
		'border-b border-white/8 transition-[background] duration-150',
		'odd:bg-[#0d0d0d] even:bg-[#111111] hover:bg-[#1a1a1a]',
		{
			'bg-gradient-to-r from-[rgba(34,197,94,0.12)] to-transparent': positionChange > 0,
			'bg-gradient-to-r from-[rgba(239,68,68,0.12)] to-transparent': positionChange < 0
		}
	);

/**
 * Get classes for driver status badge
 */
export const getStatusClasses = (status: DriverStatus) =>
	classNames('text-[11px] font-semibold uppercase tracking-[0.03em]', {
		'text-[#3b82f6]': status === 'PIT',
		'text-[#f97316]': status === 'OUT',
		'text-[#22c55e]': status === 'TRACK'
	});

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

/**
 * Get classes for sector time display
 */
export const getSectorClasses = (status: SectorStatus) =>
	classNames('px-3 h-11 align-middle whitespace-nowrap font-mono text-xs', {
		'text-[#a855f7] bg-[rgba(168,85,247,0.1)]': status === 'fastest',
		'text-[#22c55e] bg-[rgba(34,197,94,0.1)]': status === 'pb',
		'text-[#eab308]': status === 'yellow'
	});

/**
 * Get classes for tire compound badge
 */
export const getTireClasses = (tire: TireCompound) =>
	classNames(
		'w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-bold',
		{
			'bg-linear-to-br from-[#ef4444] to-[#dc2626] shadow-red': tire === 'S',
			'bg-linear-to-br from-[#fbbf24] to-[#f59e0b] text-black shadow-yellow': tire === 'M',
			'bg-linear-to-br from-[#f5f5f5] to-[#d4d4d4] text-black shadow-white': tire === 'H'
		}
	);
