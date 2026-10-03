import { expect, test } from '@playwright/test';

import { mailedLink, openRace, testEmail } from '../fixtures.ts';

// Not 9858: the replay profile plays that race live, and a live session takes over its page.
test('a saved session loads from the static data files', async ({ page }) => {
	const snapshot = page.waitForResponse((response) =>
		response.url().endsWith('/snapshots/9854.json.gz')
	);

	await openRace(page, '/?session=9854');
	await expect(page.getByTestId('session')).not.toContainText('Live');

	const response = await snapshot;

	expect(response.status()).toBe(200);
	expect(response.headers()['content-encoding']).toBe('gzip');
});

test('sign-in with the dev mailbox and the fake checkout work through the production build', async ({
	page
}) => {
	const email = testEmail('stack');

	await openRace(page, '/library');
	await page.getByRole('button', { name: 'Sign in' }).click();

	const dialog = page.getByRole('dialog', { name: 'Sign in' });

	await dialog.getByLabel('Email').fill(email);
	await dialog.getByRole('button', { name: 'Email me a link' }).click();
	await expect(dialog.getByTestId('sign-in-sent')).toContainText(email);

	await page.goto(await mailedLink(page, email));
	await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

	await page.goto('/account');
	await page.getByTestId('go-pro').click();
	await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
	await page.getByRole('button', { name: 'Pay' }).click();
	await expect(page.getByText('Pro is on')).toBeVisible();
});

test('a replayed race reaches the browser through ingest and the relay', async ({ page }) => {
	test.skip(!process.env.STACK_REPLAY, 'start the replay profile and set STACK_REPLAY=1');
	test.setTimeout(180_000);

	await openRace(page, '/');
	await expect(page.getByTestId('live-key')).toHaveText('Live');
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 2/50', { timeout: 150_000 });
});
