import { expect, test } from '@playwright/test';
import { z } from 'zod';

import { openRace, signInWithLink, testEmail } from './fixtures.ts';

const settingsReply = z.object({
	settings: z
		.object({ delaySeconds: z.number(), quiet: z.object({ enabled: z.boolean() }) })
		.nullable()
});

test('alerts are chosen per kind, kept in the browser and shown as a sample', async ({ page }) => {
	await openRace(page, '/alerts');

	await expect(page.getByRole('heading', { name: 'Alerts', level: 1 })).toBeVisible();

	const penalty = page.getByTestId('alert-toast-penalty');

	await expect(penalty).toHaveText('On');
	await penalty.click();
	await expect(penalty).toHaveText('Off');

	await page.reload();
	await expect(page.getByTestId('alert-toast-penalty')).toHaveText('Off');

	await page.getByRole('button', { name: 'Show a sample Flags alert' }).click();
	await expect(
		page.locator('[data-sonner-toast]').filter({ hasText: 'Safety car' }).first()
	).toBeVisible();

	// Pushes need an account: signed out, the push keys are off and the way in is offered.
	await expect(page.getByTestId('alert-push-flag')).toBeDisabled();
	await expect(page.getByTestId('push-status')).toContainText('They need an account');
});

test('quiet hours and the wait before a push are kept, and follow the account to another device', async ({
	page,
	browser
}) => {
	const email = testEmail('alerts');

	await openRace(page, '/alerts');
	await signInWithLink(page, email);
	await page.goto('/alerts');

	// A development page has no service worker, which is what receives pushes.
	await expect(page.getByTestId('push-status')).toContainText(
		'installed app or the production build'
	);
	await expect(page.getByTestId('alert-push-flag')).toBeEnabled();

	await page.getByTestId('quiet-toggle').click();
	await page.getByTestId('quiet-from').fill('22:30');
	await page.getByRole('radio', { name: '20 s' }).click();
	await page.getByTestId('alert-push-penalty').click();

	// The account holds them a moment after the last change.
	await expect
		.poll(
			async () =>
				settingsReply.parse(await (await page.request.get('/api/me/alerts')).json()).settings
					?.delaySeconds
		)
		.toBe(20);

	const otherContext = await browser.newContext();
	const other = await otherContext.newPage();

	await openRace(other, '/alerts');
	await signInWithLink(other, email);
	await other.goto('/alerts');
	await expect(other.getByTestId('quiet-toggle')).toHaveText('On');
	await expect(other.getByTestId('quiet-from')).toHaveValue('22:30');
	await expect(other.getByRole('radio', { name: '20 s' })).toBeChecked();
	await expect(other.getByTestId('alert-push-penalty')).toHaveText('Off');

	await otherContext.close();
});
