/**
 * Format lap time in milliseconds to readable format
 *
 * @param ms - Time in milliseconds
 * @returns Formatted time string (e.g., "1:23.456" or "23.456")
 *
 * @example
 * formatLapTime(83456) // "1:23.456"
 * formatLapTime(23456) // "23.456"
 * formatLapTime(null)  // "-"
 */
export function formatLapTime(ms: number | null | undefined): string {
	if (ms == null) return '-';

	const seconds = Math.floor(ms / 1000);
	const milliseconds = ms % 1000;

	// If time is over 1 minute
	if (seconds >= 60) {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;

		return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
	}

	// Under 1 minute
	return `${seconds}.${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Format sector time in milliseconds to readable format
 *
 * @param ms - Time in milliseconds
 * @returns Formatted sector time (e.g., "23.456")
 *
 * @example
 * formatSectorTime(23456) // "23.456"
 * formatSectorTime(null)  // "-"
 */
export function formatSectorTime(ms: number | null | undefined): string {
	if (ms == null) return '-';

	const seconds = Math.floor(ms / 1000);
	const milliseconds = ms % 1000;

	return `${seconds}.${milliseconds.toString().padStart(3, '0')}`;
}
