import { expect, type Page } from '@playwright/test';

/**
 * Opens a page of the mock replay as a returning viewer and waits until the race has loaded.
 * formula1.com pictures are refused so every run sees the same drawn fallbacks.
 */
export async function openRace(page: Page, path = '/'): Promise<void> {
	await page.route('https://media.formula1.com/**', (route) => route.abort());
	await page.addInitScript(() => window.localStorage.setItem('pitwall-welcomed', 'true'));
	await page.goto(path);
	await expect(page.getByTestId('lap-counter')).toBeVisible();
}
