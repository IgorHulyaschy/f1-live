import { expect, type Page, test } from '@playwright/test';

import { fromMenu, goPro, signInWithLink } from '../e2e/fixtures.ts';
import { docShot, openDocs } from './docs.ts';

/**
 * The accounts tour: signing in with an emailed link, the account page, the Free limit, the fake
 * checkout, Pro, publishing to the library, and alerts. Mock replay with its in-memory accounts
 * server and the fake payment provider; docs/tour/accounts/.
 *
 * Addresses are fixed (the pictures show them) and every test deletes its account at the end, so
 * a second run, even against a server that is still up, starts from nothing.
 */

const AREA = 'accounts';

/** What the account page shows as dates comes from the server's clock; a picture must not. */
const MEMBER_SINCE = '2026-05-04T09:00:00.000Z';

const RENEWS = '2026-06-04T09:00:00.000Z';

const HANDLE = 'pitlane_fan';

let email = '';

function origin(page: Page): string {
	return new URL(page.url()).origin;
}

/** The account's dates are pinned to fixed ones in every answer of the accounts server. */
async function pinAccountDates(page: Page): Promise<void> {
	await page.route(/\/api\/me$/, async (route) => {
		const response = await route.fetch();

		if (route.request().method() !== 'GET') {
			return route.fulfill({ response });
		}

		// SAFETY: this is the /api/me answer of the accounts server; only the two date fields are read.
		const body = (await response.json()) as {
			user?: { createdAt: string };
			subscription?: { currentPeriodEnd: string | null } | null;
		} | null;

		if (body?.user) {
			body.user.createdAt = MEMBER_SINCE;
		}

		if (body?.subscription?.currentPeriodEnd) {
			body.subscription.currentPeriodEnd = RENEWS;
		}

		return route.fulfill({ response, json: body });
	});
}

/**
 * The account page down to its Your data keys: the page's own footer (the unofficial notice) is
 * left out, so no line is cut by the crop.
 */
async function accountShot(page: Page, name: string): Promise<void> {
	const account = await page.getByTestId('account-page').boundingBox();
	const keys = await page.getByRole('button', { name: 'Delete account' }).boundingBox();

	if (!account || !keys) {
		throw new Error('The account page is not on screen');
	}

	await docShot(page, AREA, name, {
		x: account.x - 24,
		y: account.y - 8,
		width: account.width + 48,
		height: keys.y + keys.height + 20 - account.y + 8
	});
}

/** Opens the app signed in as `address`, on the account page. */
async function openSignedIn(
	page: Page,
	address: string,
	options: { theme?: 'dark' | 'light'; route?: string } = {}
): Promise<void> {
	email = address;
	await pinAccountDates(page);
	await openDocs(page, '/account?lap=30', options);
	await expect(page.getByRole('region', { name: 'Sign in' })).toBeVisible({ timeout: 20_000 });
	await signInWithLink(page, address);
	await page.goto(options.route ?? '/account?lap=30');
	await expect(page.getByTestId('app-menu')).toBeVisible();
}

test.afterEach(async ({ page }) => {
	if (!email) {
		return;
	}

	const address = email;

	email = '';

	// Pro and the library entry go with the account.
	await page.request.delete('/api/me', {
		headers: { origin: origin(page) },
		data: { confirm: address }
	});
});

// `email` is module state: tests run one after another so it is always this test's account.
test.describe.configure({ mode: 'serial' });

test('sign-in: one email, no password', async ({ page }) => {
	await openDocs(page, '/library?lap=30');
	await expect(page.getByTestId('library')).toBeVisible();
	await fromMenu(page, 'Sign in');

	const dialog = page.getByRole('dialog', { name: 'Sign in' });

	await dialog.getByLabel('Email').fill('riley@example.test');
	await expect(dialog.getByRole('button', { name: 'Email me a link' })).toBeVisible();
	await docShot(page, AREA, 'sign-in-dialog', dialog, 24);

	await dialog.getByRole('button', { name: 'Email me a link' }).click();
	await expect(dialog.getByTestId('sign-in-sent')).toContainText('riley@example.test');
	await docShot(page, AREA, 'sign-in-sent', dialog, 24);
});

test('the account page on Free: plan, your data, delete', async ({ page }) => {
	await openSignedIn(page, 'sam@example.test');

	const account = page.getByTestId('account-page');

	await expect(account.getByRole('region', { name: 'Plan' })).toContainText('Go Pro');
	await expect(account.getByText('May 4, 2026')).toBeVisible();
	await accountShot(page, 'account-free');

	await account.getByRole('button', { name: 'Delete account' }).click();

	const dialog = page.getByRole('dialog', { name: 'Delete your account?' });

	await dialog.getByLabel('Email to confirm').fill('sam@example.test');
	await expect(dialog.getByRole('button', { name: 'Delete account' })).toBeEnabled();
	await docShot(page, AREA, 'account-delete', dialog, 24);
});

test('the Free limit holds at three dashboards and points to Pro', async ({ page }) => {
	await openDocs(page, '/library?lap=30');
	await expect(page.getByTestId('library')).toBeVisible();

	for (const name of ['Second screen', 'TV wall', 'Teammates']) {
		await page.goto('/library?lap=30');
		await page
			.getByTestId('library-row')
			.filter({ hasText: name })
			.getByRole('button', { name: `Add ${name}` })
			.click();
		await expect(page).toHaveURL(/\/d\/board-/);
	}

	await page.goto('/library?lap=30');
	await page
		.getByTestId('library-row')
		.filter({ hasText: 'Driver wall' })
		.getByRole('button', { name: 'Add Driver wall' })
		.click();

	const toast = page.locator('[data-sonner-toast]').filter({ hasText: 'Free keeps 3 dashboards' });

	await expect(toast).toBeVisible();
	await docShot(page, AREA, 'free-limit', toast, 40);
});

test('the bar menu offers Preview Pro without an account', async ({ page }) => {
	await openDocs(page, '/library?lap=30');
	await expect(page.getByTestId('library')).toBeVisible();
	await page.getByTestId('app-menu').click();

	const menu = page.getByRole('menu');

	await expect(menu.getByRole('menuitemcheckbox', { name: 'Preview Pro' })).toBeVisible();
	await docShot(page, AREA, 'menu-preview-pro', menu, 12);
});

test('checkout with the fake payment provider, then Pro', async ({ page }) => {
	await openSignedIn(page, 'jordan@example.test');
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.getByTestId('go-pro').click();
	await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
	await docShot(page, AREA, 'checkout', page.locator('main'), 40);

	await page.getByRole('button', { name: 'Pay' }).click();
	await expect(page).toHaveURL(/\/account/);
	await expect(page.getByText('Pro is on')).toBeVisible();
	await page.goto('/account?lap=30');

	const plan = page.getByRole('region', { name: 'Plan' });

	await expect(plan).toContainText('Renews');
	await accountShot(page, 'account-pro');
});

test('publishing to the library under a handle, then it leads From fans', async ({ page }) => {
	test.slow();
	// Tall, so the From fans rows are on screen.
	await page.setViewportSize({ width: 1440, height: 1700 });
	await openSignedIn(page, 'morgan@example.test');
	await goPro(page);
	await page.goto('/library?lap=30');
	await page
		.getByTestId('library-row')
		.filter({ hasText: 'Second screen' })
		.getByRole('button', { name: 'Add Second screen' })
		.click();
	await expect(page).toHaveURL(/\/d\/board-/);
	await page.goto('/library?lap=30');
	await page
		.getByRole('region', { name: 'Yours' })
		.getByRole('button', { name: 'Publish' })
		.click();

	const dialog = page.getByTestId('publish-dialog');

	await dialog.getByTestId('handle-input').fill(HANDLE);
	await expect(dialog.getByText(`@${HANDLE} is free`)).toBeVisible();
	await docShot(page, AREA, 'publish-handle', dialog, 24);

	await dialog.getByRole('button', { name: 'Use this handle' }).click();
	await dialog.getByTestId('publish-description').fill('Laptop next to the TV');
	await dialog.getByTestId('publish-tags').fill('Laptop, Race day');
	await docShot(page, AREA, 'publish-dialog', dialog, 24);

	await dialog.getByRole('button', { name: 'Publish' }).click();
	await expect(page.getByRole('region', { name: 'Yours' })).toContainText('Published');
	await expect(dialog).toBeHidden();

	await page.getByTestId('library-search').fill(`@${HANDLE}`);

	const fans = page.getByRole('region', { name: 'From fans' });

	await expect(fans.getByTestId('library-row')).toHaveCount(1);
	await expect(fans).toContainText(`by @${HANDLE}`);
	// The "in the library" toast sits over the page; wait it out.
	await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 });

	const head = await fans.boundingBox();
	const row = await fans.getByTestId('library-row').boundingBox();

	if (!head || !row) {
		throw new Error('From fans is not on screen');
	}

	await docShot(page, AREA, 'library-published', {
		x: 0,
		y: head.y,
		width: 920,
		height: row.y + row.height - head.y + 8
	});
	await page.getByRole('button', { name: /^Unpublish / }).click();
});

test('alerts: what to be told, and when not to be', async ({ page }) => {
	await openSignedIn(page, 'casey@example.test', { route: '/alerts?lap=30' });
	await expect(page.getByTestId('alerts')).toBeVisible();
	await page.getByTestId('quiet-toggle').click();
	await page.getByRole('radio', { name: '10 s' }).click();
	await page.setViewportSize({ width: 1440, height: 1400 });

	// Down to the closing note: the page footer under it would be cut.
	const note = await page.getByText(/spoiler protection is on/).boundingBox();
	const alerts = await page.getByTestId('alerts').boundingBox();

	if (!note || !alerts) {
		throw new Error('The alerts page is not on screen');
	}

	await docShot(page, AREA, 'alerts', {
		x: alerts.x - 24,
		y: alerts.y - 24,
		width: alerts.width + 48,
		height: note.y + note.height + 16 - alerts.y + 24
	});
});

test('the account page in the light theme', async ({ page }) => {
	await openSignedIn(page, 'avery@example.test', { theme: 'light' });
	await expect(page.locator('html')).not.toHaveClass(/dark/);
	await accountShot(page, 'account-free-light');
});

test.describe('phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('the account page on a phone', async ({ page }) => {
		await openSignedIn(page, 'quinn@example.test');
		await expect(page.getByTestId('account-page')).toBeVisible();

		// Down to the Go Pro key: the next section would be cut by the screen.
		const goProKey = await page.getByTestId('go-pro').boundingBox();

		if (!goProKey) {
			throw new Error('Go Pro is not on screen');
		}

		await docShot(page, AREA, 'account-free-phone', {
			x: 0,
			y: 0,
			width: 390,
			height: goProKey.y + goProKey.height + 24
		});
	});
});
