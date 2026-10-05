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

/** 2345 → "+2.345"; a gap of a minute or more, as after a red flag, 75500 → "+1:15.500". */
export function formatGap(ms: number): string {
	return ms >= 60_000 ? `+${formatLapTime(ms)}` : `+${(ms / 1000).toFixed(3)}`;
}

/** Signed seconds with one decimal: 0.42 → "+0.4s", -1.26 → "−1.3s". */
export function formatDeltaSeconds(seconds: number, digits = 1): string {
	const sign = seconds < 0 ? '−' : '+';

	return `${sign}${Math.abs(seconds).toFixed(digits)}s`;
}

/** A count with its unit, in the singular for exactly one: "1 lap", "12 laps", "1,204 laps". */
export function plural(count: number, one: string, many = `${one}s`): string {
	return `${count.toLocaleString('en-GB')} ${count === 1 ? one : many}`;
}
