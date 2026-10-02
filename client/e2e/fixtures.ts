import { expect, type Page } from '@playwright/test';

/** Opens a page of the mock replay and waits until the race has loaded. */
export async function openRace(page: Page, path = '/'): Promise<void> {
	await page.goto(path);
	await expect(page.getByTestId('lap-counter')).toBeVisible();
}
