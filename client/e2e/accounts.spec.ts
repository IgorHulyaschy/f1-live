import { expect, type Page, test } from '@playwright/test';
import { z } from 'zod';

import { mailedLink, openRace, signInWithLink, testEmail } from './fixtures.ts';

const FAN_DASHBOARDS = ['Second screen', 'TV wall', 'Teammates', 'Driver wall', 'Just the order'];

const documentsReply = z.object({
	documents: z.array(z.object({ dashboard: z.object({ id: z.string() }).nullable() }))
});

const viewerReply = z.object({ revealed: z.array(z.string()) });

async function addFromLibrary(page: Page, name: string): Promise<void> {
	await page.goto('/library');
	await page
		.getByRole('button', { name: `Add ${name}` })
		.first()
		.click();
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

/** The sessions the account holds as revealed; an empty merge changes nothing. */
async function accountReveals(page: Page): Promise<string[]> {
	const response = await page.request.put('/api/me/viewer', {
		data: { protect: true, protectUpdatedAt: null, revealed: [] }
	});

	return viewerReply.parse(await response.json()).revealed;
}

function yours(page: Page) {
	return page.getByRole('region', { name: 'Yours' }).getByTestId('library-row');
}

test('an account syncs dashboards, holds the Free limit, goes Pro and can be deleted', async ({
	page,
	browser
}) => {
	// One journey through two browsers and a checkout: longer than a page check.
	test.slow();

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

test('a dashboard edit appears on another signed-in device without a reload', async ({
	page,
	browser
}) => {
	const email = testEmail('push');
	const otherContext = await browser.newContext();
	const other = await otherContext.newPage();

	await openRace(page, '/library');
	await signInWithLink(page, email);
	await openRace(other, '/library');
	await signInWithLink(other, email);
	await other.goto('/library');
	await expect(yours(other)).toHaveCount(0);

	// Well inside the 30 s pull: only the server's nudge can bring it this fast.
	const quickly = { timeout: 8000 };

	await addFromLibrary(page, 'Second screen');
	await expect(yours(other).filter({ hasText: 'Second screen' })).toHaveCount(1, quickly);

	await page.getByRole('button', { name: 'Edit' }).click();
	await page.getByLabel('Dashboard name').fill('Pushed rename');
	await page.getByLabel('Dashboard name').blur();
	await expect(yours(other).filter({ hasText: 'Pushed rename' })).toHaveCount(1, quickly);
	await expect(other.getByText('Second screen changed on another device')).toHaveCount(0);

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

test('a session revealed on one device opens revealed on another signed in to the account', async ({
	page,
	browser
}) => {
	const email = testEmail('catch-up');

	await openRace(page, '/session', { spoilerProtection: true });
	await signInWithLink(page, email);
	await page.goto('/session');
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 1/50');
	await page.getByRole('button', { name: 'Jump to the finish (shows results)' }).first().click();
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 50/50');

	// The reveal reaches the account a moment after it is made.
	await expect.poll(() => accountReveals(page)).not.toEqual([]);

	const other = await browser.newPage();
	let answer: (() => void) | undefined;

	const answered = new Promise<void>((resolve) => {
		answer = resolve;
	});

	// The account's settings answer only after this device has opened the session.
	await other.route('**/api/me/viewer', async (route) => {
		await answered;
		await route.continue();
	});
	await openRace(other, '/session', { spoilerProtection: true });
	await signInWithLink(other, email);
	await other.goto('/session');
	await expect(other.getByTestId('lap-counter')).toHaveText('Lap 1/50');
	answer?.();
	// Revealed, the modelled replay moves to where it always opens.
	await expect(other.getByTestId('lap-counter')).toHaveText('Lap 30/50');
	await other.close();
});
