/** 95123 → "1:35.123". */
export function formatLapTime(ms: number): string {
	const minutes = Math.floor(ms / 60_000);
	const seconds = (ms % 60_000) / 1000;

	return minutes > 0 ? `${minutes}:${seconds.toFixed(3).padStart(6, '0')}` : seconds.toFixed(3);
}

/** 28123 → "28.123". */
export function formatSectorTime(ms: number): string {
	return (ms / 1000).toFixed(3);
}

/** 2345 → "+2.345". */
export function formatGap(ms: number): string {
	return `+${(ms / 1000).toFixed(3)}`;
}

/** Signed seconds with one decimal: 0.42 → "+0.4s", -1.26 → "−1.3s". */
export function formatDeltaSeconds(seconds: number): string {
	const sign = seconds < 0 ? '−' : '+';

	return `${sign}${Math.abs(seconds).toFixed(1)}s`;
}
