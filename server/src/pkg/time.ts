/**
 * Converts a timing-feed duration ("1:32.456" or "28.123") to milliseconds.
 * Returns null for the empty string the feed sends while a sector or lap is running.
 */
export function parseTime(time: string): number | null {
	if (time === '') {
		return null;
	}

	const [minutesPart, secondsPart] = time.includes(':') ? time.split(':') : ['0', time];
	const totalMs = Number(minutesPart) * 60_000 + Math.round(Number(secondsPart) * 1000);

	return Number.isFinite(totalMs) ? totalMs : null;
}
