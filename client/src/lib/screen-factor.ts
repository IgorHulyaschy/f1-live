/** The screen size, in CSS pixels, the console is drawn for at 16 px text. */
const BASE = 1080;

/**
 * How much larger than a 1080p screen to draw the console: the shorter of the window's height
 * and its width at 16:10, past 1080 px, grows text by half that ratio, up to one and a half. A
 * 1440p monitor reads like a laptop instead of a page of fine print, and an ultrawide is sized
 * by its height. Steps of 1/16 keep a pixel grid and stop a resize from shifting it by a hair.
 */
export function screenFactor(width: number, height: number): number {
	const size = Math.min(height, width / 1.6);
	const factor = Math.min(Math.max(1 + (size - BASE) / (2 * BASE), 1), 1.5);

	return Math.round(factor * 16) / 16;
}
