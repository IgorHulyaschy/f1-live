import type { Page } from '@playwright/test';

/** A 1x1 transparent PNG: stands in for every picture the media host would serve. */
const PIXEL = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
	'base64'
);

export const MEDIA_HOST = 'https://media.formula1.com/**';

/** Serves the test image for the media host; returns the requests it saw. */
export async function serveTestPictures(page: Page): Promise<string[]> {
	const seen: string[] = [];

	await page.route(MEDIA_HOST, (route) => {
		seen.push(route.request().url());

		return route.fulfill({ contentType: 'image/png', body: PIXEL });
	});

	return seen;
}

/** Fails every media request, as a blocked or missing picture does. */
export async function breakTestPictures(page: Page): Promise<void> {
	await page.route(MEDIA_HOST, (route) => route.abort());
}
