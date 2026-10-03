import { expect, type Page, test } from '@playwright/test';
import { z } from 'zod';

import { mailedLink, openRace, signInWithLink, testEmail } from './fixtures.ts';

const FAN_DASHBOARDS = ['Second screen', 'TV wall', 'Teammates', 'Driver wall', 'Just the order'];

const documentsReply = z.object({
	documents: z.array(z.object({ dashboard: z.object({ id: z.string() }).nullable() }))
});

async function addFromLibrary(page: Page, name: string): Promise<void> {
	await page.goto('/library');
	await page.getByRole('button', { name: `Add ${name}` }).click();
	await expect(page).toHaveURL(/\/d\/board-/);
}

/** Waits until the account holds `count` dashboards of this browser's: sync runs in the background. */
async function expectSynced(page: Page, count: number): Promise<void> {
	await expect
		.poll(async () => {
			const response = await page.request.get('/api/me/dashboards');
			const body = documentsReply.parse(await response.json());

			return body.documents.filter((document) => document.dashboard !== null).length;
		})
		.toBe(count);
}

function yours(page: Page) {
	return page.getByRole('region', { name: 'Yours' }).getByTestId('library-row');
}

test('an account syncs dashboards, holds the Free limit, goes Pro and can be deleted', async ({
	page,
	browser
}) => {
	const email = testEmail('fan');

	await openRace(page, '/library');

	// Sign in with the emailed link, from the bar.
	await page.getByRole('button', { name: 'Sign in' }).click();

	const dialog = page.getByRole('dialog', { name: 'Sign in' });

	await dialog.getByLabel('Email').fill(email);
	await dialog.getByRole('button', { name: 'Email me a link' }).click();
	await expect(dialog.getByTestId('sign-in-sent')).toContainText(email);

	await page.goto(await mailedLink(page, email));
	await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
	await expect(page.getByTestId('account-menu')).toBeVisible();

	// Free keeps three of your own; the fourth is refused with the upgrade prompt.
	for (const name of FAN_DASHBOARDS.slice(0, 3)) {
		await addFromLibrary(page, name);
	}

	await page.goto('/library');
	await page.getByRole('button', { name: 'Add Driver wall' }).click();
	await expect(page.getByText('Free keeps 3 dashboards of your own')).toBeVisible();
	await page.getByRole('button', { name: 'Go Pro' }).click();
	await expect(page).toHaveURL(/\/account\?.*upgrade=1/);

	// The fake provider's checkout: Pay sends a signed webhook, and the account turns Pro.
	await page.getByTestId('go-pro').click();
	await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
	await page.getByRole('button', { name: 'Pay' }).click();
	await expect(page).toHaveURL(/\/account/);
	await expect(page.getByText('Pro is on')).toBeVisible();
	await expect(page.getByRole('region', { name: 'Plan' })).toContainText('Renews');
	await expect(page.getByRole('radiogroup', { name: 'Plan preview' })).toHaveCount(0);

	// Pro keeps any number.
	for (const name of FAN_DASHBOARDS.slice(3)) {
		await addFromLibrary(page, name);
	}

	await expectSynced(page, 5);

	// Another browser signed in to the same account sees the same dashboards.
	const otherContext = await browser.newContext();
	const other = await otherContext.newPage();

	await openRace(other, '/library');
	await signInWithLink(other, email);
	await other.goto('/library');
	await expect(yours(other)).toHaveCount(5);

	for (const name of FAN_DASHBOARDS) {
		await expect(yours(other).filter({ hasText: name })).toHaveCount(1);
	}

	// A rename there reaches the first browser.
	await other.getByRole('link', { name: 'Open' }).first().click();
	await other.getByRole('button', { name: 'Edit' }).click();
	await other.getByLabel('Dashboard name').fill('Renamed on the phone');
	await other.getByLabel('Dashboard name').blur();
	await expect(other.getByTestId('save-status')).toHaveText('Synced to your account');

	await page.goto('/library');
	await expect(yours(page).filter({ hasText: 'Renamed on the phone' })).toHaveCount(1);

	// Deleting the account removes it everywhere and ends Pro.
	await other.goto('/account');
	await other.getByRole('button', { name: 'Delete account' }).click();

	const confirm = other.getByRole('dialog', { name: 'Delete your account?' });

	await confirm.getByLabel('Email to confirm').fill(email);
	await confirm.getByRole('button', { name: 'Delete account' }).click();
	await expect(other.getByText('Account deleted')).toBeVisible();
	await expect(other.getByRole('button', { name: 'Sign in' })).toBeVisible();

	await page.reload();
	await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
	expect(await (await page.request.get('/api/me')).json()).toBeNull();

	await otherContext.close();
});

test('without an account, the account page offers sign-in and dashboards stay here', async ({
	page
}) => {
	const errors: string[] = [];

	page.on('console', (message) => {
		if (message.type() === 'error') {
			errors.push(message.text());
		}
	});

	await openRace(page, '/account');

	await expect(page.getByRole('region', { name: 'Sign in' }).getByLabel('Email')).toBeVisible();
	await expect(page.getByRole('region', { name: 'Plans' })).toContainText('3 of your own');

	await page.goto('/d/battle?edit=1');
	await expect(page.getByTestId('save-status')).toHaveText('Saved in this browser');
	expect(errors, 'a signed-out visitor costs no failed requests').toEqual([]);
});
