import { expect, type Page, test } from '@playwright/test';

import { serveTestPictures } from '../pictures';

// Ask on the results index of 2018 to 2026 and the saved 2025 Las Vegas sessions.

async function openAsk(
	page: Page,
	{ spoilerProtection = false }: { spoilerProtection?: boolean } = {}
): Promise<void> {
	await serveTestPictures(page);
	await page.addInitScript(() => window.localStorage.setItem('pitwall-welcomed', 'true'));

	if (!spoilerProtection) {
		await page.addInitScript(() => window.localStorage.setItem('pitwall-spoiler-free', 'false'));
	}

	await page.goto('/session?session=9858');
	await expect(page.getByTestId('lap-counter')).toBeVisible({ timeout: 15_000 });
	await page.keyboard.press('Control+k');
}

async function ask(page: Page, question: string): Promise<void> {
	await page.getByTestId('ask-input').fill(question);
}

test('a pair and a year answer head to head, and the proof opens it', async ({ page }) => {
	await openAsk(page);
	await ask(page, 'norris vs piastri 2024');

	const answer = page.getByTestId('ask-answer');

	await expect(answer).toContainText('Norris', { timeout: 15_000 });
	await expect(answer.getByRole('link').first()).toHaveAttribute('href', /^\//);
	await page.keyboard.press('Enter');

	await expect(page).toHaveURL(/\/h2h\?a=lando-norris&b=oscar-piastri/);
	await expect(page.getByTestId('h2h-name-a')).toHaveText('Lando Norris', { timeout: 15_000 });
	await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a question about a seen session answers with the winner', async ({ page }) => {
	await openAsk(page);
	await ask(page, 'who won vegas 2025');

	await expect(page.getByTestId('ask-answer')).toContainText('won the 2025 Las Vegas GP', {
		timeout: 15_000
	});
	await page.getByTestId('ask-proof').click();
	await expect(page).toHaveURL(/session=9858/);
});

test('a question about an unseen session offers to reveal it and shows no result', async ({
	page
}) => {
	// Two days after Las Vegas 2025: its race is recent and unseen.
	await page.clock.setFixedTime(new Date('2025-11-24T12:00:00.000Z'));
	await openAsk(page, { spoilerProtection: true });
	await ask(page, 'who won vegas 2025');

	await expect(page.getByTestId('ask-held')).toContainText('2025 Las Vegas GP Race', {
		timeout: 15_000
	});
	await expect(page.getByTestId('ask-answer')).toHaveCount(0);
	await expect(page.getByRole('dialog')).not.toContainText('Verstappen');

	await page.getByTestId('ask-reveal').click();
	await expect(page.getByTestId('ask-answer')).toContainText('won the 2025 Las Vegas GP');
});

test('what happened to a driver answers with how the race ended, and the moments open the lap', async ({
	page
}) => {
	// The evening of the 2026 Bahrain race, in which Russell stopped on lap 50.
	await page.clock.setFixedTime(new Date('2026-10-04T12:00:00.000Z'));
	await openAsk(page);
	await ask(page, 'what happened to russell in bahrain');

	const answer = page.getByTestId('ask-answer');

	await expect(answer).toContainText(
		'Russell retired on lap 50: stopped on track under yellow flags, still classified P20 with 49 of 55 laps',
		{ timeout: 15_000 }
	);
	await expect(answer.getByTestId('ask-sparkline')).toBeVisible();

	// The cross sits at lap 50 of 55 along the line, not at the right edge.
	const sparkline = answer.getByTestId('ask-sparkline');
	const frame = await sparkline.boundingBox();
	const out = await sparkline.locator('path[stroke="var(--danger)"]').boundingBox();
	const share = frame && out ? (out.x + out.width / 2 - frame.x) / frame.width : 0;

	// In the picture's units: the plot runs from 26 to 352 of 360 across the 55 laps.
	expect(share * 360).toBeCloseTo(26 + (50 / 55) * 326, -1);

	const moments = answer.getByTestId('ask-moments').getByRole('listitem');

	await expect(moments).toHaveCount(6);
	await moments.last().getByRole('link').click();
	await expect(page).toHaveURL(/session=11731&car=63&carLap=50/);
});

test('a gap question answers from the standings and the proof opens them', async ({ page }) => {
	await openAsk(page);
	await ask(page, 'how many points is piastri behind in 2025');

	await expect(page.getByTestId('ask-answer')).toContainText(
		'Piastri is 13 points behind the leader, Norris',
		{ timeout: 15_000 }
	);
	await page.getByTestId('ask-proof').click();
	await expect(page).toHaveURL(/\/standings\?season=2025/);
});

test('an answer about the open session adds its tile to a dashboard', async ({ page }) => {
	await openAsk(page);
	await ask(page, 'pit stops in this session');

	await expect(page.getByTestId('ask-answer')).toBeVisible({ timeout: 15_000 });
	await page.locator('[data-testid^="ask-add-"]').first().click();

	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(page.getByText(/^Pit stops added to /)).toBeVisible();
});

test('Surprise me asks a true question whose proof opens', async ({ page }) => {
	// A fixed pick: the saved fixture holds the results of every season but only a few sessions.
	await page.addInitScript(() => {
		Math.random = () => 0;
	});
	await openAsk(page);
	await page.getByTestId('ask-surprise').click();

	await expect(page.getByTestId('ask-answer')).toBeVisible({ timeout: 15_000 });
	await expect(page.getByTestId('ask-input')).not.toHaveValue('');

	await page.getByTestId('ask-proof').click();
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(page).not.toHaveURL(/session=9858/);
	await expect(page.getByRole('alert')).toHaveCount(0);
	await expect(page.getByRole('main')).not.toBeEmpty();
});

test('a failed results load says so, and Try again answers', async ({ page }) => {
	let failing = true;

	await page.route('**/results/2021.json.gz', (route) =>
		failing ? route.fulfill({ status: 500 }) : route.continue()
	);
	await openAsk(page);
	await ask(page, 'standings 2021');

	await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
		'The results could not be loaded',
		{ timeout: 15_000 }
	);
	failing = false;
	await page.getByTestId('ask-retry').click();
	await expect(page.getByTestId('ask-answer')).toContainText('Verstappen', { timeout: 15_000 });
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('the header search button opens Ask on the whole screen', async ({ page }) => {
		await serveTestPictures(page);
		await page.addInitScript(() => {
			window.localStorage.setItem('pitwall-welcomed', 'true');
			window.localStorage.setItem('pitwall-spoiler-free', 'false');
		});
		await page.goto('/session?session=9858');

		await page.getByTestId('ask-button').click();

		const dialog = page.getByRole('dialog');

		await expect(page.getByTestId('ask-input')).toBeFocused();
		// Once its zoom-in settles.
		await expect.poll(async () => (await dialog.boundingBox())?.width).toBe(390);

		await ask(page, 'standings 2021');
		await expect(page.getByTestId('ask-answer')).toContainText('Verstappen', { timeout: 15_000 });
		await page.getByTestId('ask-proof').click();
		await expect(page).toHaveURL(/\/standings\?season=2021/);
	});
});

test('a record answer shows the driver’s portrait, named for them', async ({ page }) => {
	await openAsk(page);
	await ask(page, 'norris wins 2025');

	await expect(
		page.getByTestId('ask-answer').getByRole('img', { name: 'Lando Norris' })
	).toBeAttached({ timeout: 15_000 });
});
