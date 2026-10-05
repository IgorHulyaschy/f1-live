import { expect, type Page } from '@playwright/test';
import { z } from 'zod';

import { fromMenu, goPro, openRace, signInWithLink, testEmail, test } from './fixtures.ts';
import { serveTestPictures } from './pictures';

test('a fan dashboard can be previewed and added from the library', async ({ page }) => {
	await openRace(page, '/library');

	await page
		.getByTestId('library-row')
		.filter({ hasText: 'Second screen' })
		.getByRole('link', { name: 'Preview' })
		.click();
	await expect(page.getByTestId('dashboard-preview')).toBeVisible();
	await expect(page.getByText('Preview of an example dashboard')).toBeVisible();

	await page.getByRole('button', { name: 'Add to my dashboards' }).click();
	await expect(page).toHaveURL(/\/d\/board-/);
	await expect(page.getByRole('link', { name: 'Second screen' })).toBeVisible();
});

/** The accounts server outlives a test; whatever a failed run left published must not leak into the next. */
async function unpublishAll(page: Page): Promise<void> {
	const reply = await page.request.get('/api/me/library');

	if (!reply.ok()) {
		return;
	}

	const mine = z
		.object({ entries: z.array(z.object({ id: z.string() })) })
		.parse(await reply.json());

	for (const { id } of mine.entries) {
		await page.request.delete(`/api/library/${id}`, {
			headers: { origin: new URL(page.url()).origin }
		});
	}
}

test.describe('publishing', () => {
	test.afterEach(({ page }) => unpublishAll(page));

	test('a Pro fan publishes a dashboard and another account finds, previews and adds it', async ({
		page,
		browser
	}) => {
		test.slow();

		const handle = `fan_${Date.now().toString(36)}`;

		await openRace(page, '/library');
		await signInWithLink(page, testEmail('publisher'));

		// Free cannot publish: the key points to Pro.
		await page.goto('/library');
		await page.getByRole('button', { name: 'Add Second screen' }).click();
		await expect(page).toHaveURL(/\/d\/board-/);
		await page.goto('/library');
		await page
			.getByRole('region', { name: 'Yours' })
			.getByRole('button', { name: 'Publish' })
			.click();
		await expect(page.getByText('Publishing is part of Pro')).toBeVisible();

		await goPro(page);
		await page.goto('/library');
		await page
			.getByRole('region', { name: 'Yours' })
			.getByRole('button', { name: 'Publish' })
			.click();

		// The handle is chosen once; a reserved name is refused while typing.
		const dialog = page.getByTestId('publish-dialog');

		await dialog.getByTestId('handle-input').fill('pitwall_news');
		await expect(dialog.getByText('That name is kept for the team')).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Use this handle' })).toBeDisabled();
		await dialog.getByTestId('handle-input').fill(handle);
		await expect(dialog.getByText(`@${handle} is free`)).toBeVisible();
		await dialog.getByRole('button', { name: 'Use this handle' }).click();

		await dialog.getByTestId('publish-description').fill('Laptop next to the TV');
		await dialog.getByTestId('publish-tags').fill('Laptop, E2E mine');
		await dialog.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByText('Second screen is in the library')).toBeVisible();
		await expect(page.getByRole('region', { name: 'Yours' })).toContainText('Published');

		// Another account finds it by handle, previews it live and adds a copy.
		const otherContext = await browser.newContext();
		const other = await otherContext.newPage();

		await openRace(other, '/library');
		await signInWithLink(other, testEmail('reader'));
		await other.goto('/library');
		await other.getByTestId('library-search').fill(`@${handle}`);

		const row = other.getByRole('region', { name: 'From fans' }).getByTestId('library-row');

		await expect(row).toHaveCount(1);
		await expect(row).toContainText(`by @${handle}`);
		await expect(row).toContainText('Laptop next to the TV');
		await row.getByRole('link', { name: 'Preview' }).click();
		await expect(other.getByText(`Preview, by @${handle}`)).toBeVisible();
		await expect(other.getByTestId('dashboard-preview')).toBeVisible();
		await other.getByRole('button', { name: 'Add to my dashboards' }).click();
		await expect(other).toHaveURL(/\/d\/board-/);

		// The count went up once, and the reader can report it.
		await other.goto('/library');
		await other.getByTestId('library-search').fill(`@${handle}`);
		await expect(row).toHaveCount(1);
		await expect(row).toContainText('1adds');
		await row.getByRole('button', { name: 'Report Second screen' }).click();
		await other
			.getByRole('dialog', { name: 'Report Second screen' })
			.getByRole('radio', { name: 'Spam or an advert' })
			.click();
		await other.getByRole('button', { name: 'Send report' }).click();
		await expect(other.getByText('Thanks, we will look at it')).toBeVisible();

		// Unpublishing takes it out of the library again.
		await page.goto('/library');
		await page
			.getByRole('region', { name: 'Yours' })
			.getByRole('button', { name: 'Unpublish' })
			.click();
		await expect(page.getByText('Second screen is no longer in the library')).toBeVisible();
		await other.goto('/library');
		await other.getByTestId('library-search').fill(`@${handle}`);
		await expect(other.getByText('Nothing matches')).toBeVisible();

		await otherContext.close();
	});
});

test('a share link opens the same dashboard in another browser', async ({ page, browser }) => {
	await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	await openRace(page, '/d/battle');

	await fromMenu(page, 'Copy share link');

	const link = await page.evaluate(() => navigator.clipboard.readText());
	const other = await browser.newPage();

	await openRace(other, link.replace(/^https?:\/\/[^/]+/, ''));
	await expect(other.getByTestId('dashboard-preview')).toBeVisible();
	await expect(other.getByTestId('chart-battle')).toBeVisible();
	await other.close();
});

test('Free keeps three dashboards of your own and points to Pro', async ({ page }) => {
	const addFromLibrary = async (name: string) => {
		await page.goto('/library');
		await page.getByRole('button', { name }).click();
		await expect(page).toHaveURL(/\/d\/board-/);
	};

	await openRace(page, '/library');
	await addFromLibrary('Add Second screen');
	await addFromLibrary('Add TV wall');
	await addFromLibrary('Add Teammates');

	await page.goto('/library');
	await page.getByRole('button', { name: 'Add Driver wall' }).click();
	await expect(page.getByText('Free keeps 3 dashboards of your own')).toBeVisible();
	await expect(page).toHaveURL(/\/library/);

	// Pro is bought on the account page; e2e/accounts.spec.ts runs the whole way there.
	await page.getByRole('button', { name: 'Go Pro' }).click();
	await expect(page).toHaveURL(/\/account\?.*upgrade=1/);
	await expect(page.getByRole('region', { name: 'Sign in' })).toContainText(
		'Pro belongs to your account'
	);
});

test('first run picks a driver and a starting dashboard', async ({ page }) => {
	await serveTestPictures(page);
	await page.goto('/');
	await page.getByRole('link', { name: 'Set up' }).click();

	// The dashboard stays on screen until the setup page commits, and its driver names open views.
	const setup = page.getByTestId('welcome');
	const norris = setup.getByRole('button', { name: /Norris/ });

	await norris.click();
	await expect(norris).toHaveAttribute('aria-pressed', 'true');
	await setup.getByRole('button', { name: /Strategy calls/ }).click();
	await setup.getByRole('button', { name: 'Start watching' }).click();

	await expect(page).toHaveURL(/\/strategy\?.*driver=4/);
	await page.goto('/d/battle');
	await expect(page.getByRole('link', { name: 'Set up' })).toHaveCount(0);
	await expect(page.getByRole('combobox', { name: 'Followed driver' })).toHaveText(/NOR/);
});

test('without a Replay tile the transport moves to the session strip', async ({ page }) => {
	await openRace(page, '/session?edit=1');

	await expect(page.getByTestId('header-clock')).toHaveCount(0);
	await page.getByRole('button', { name: 'Remove Replay' }).click();
	await expect(page.getByTestId('header-clock')).toBeVisible();
	await expect(page.getByTestId('lap-counter')).toHaveCount(1);
});
