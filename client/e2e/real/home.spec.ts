import { expect, test } from '@playwright/test';

import { serveTestPictures } from '../pictures';

test('the home’s championship says which recent rounds it holds back and shows them in one click', async ({
	page
}) => {
	// A week after Baku 2026: Monza, Madrid, Baku and the saved Bahrain race are recent and unseen, so the table stops at R12.
	await page.clock.setFixedTime(new Date('2026-10-03T12:00:00.000Z'));
	await serveTestPictures(page);
	await page.addInitScript(() => window.localStorage.setItem('pitwall-welcomed', 'true'));
	await page.goto('/');

	const held = page.getByTestId('home-held-rounds');

	// The first visit compiles the page and loads the season in the dev server.
	await expect(held).toContainText('4 recent rounds are held back', { timeout: 15_000 });
	await expect(page.getByTestId('home-championship')).toBeVisible();
	await expect(page.getByText('2026, after R12')).toBeVisible();

	await held.getByRole('button', { name: 'Show them' }).click();

	await expect(held).toHaveCount(0);
	await expect(page.getByText('2026, after R16')).toBeVisible();
});
