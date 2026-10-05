import { expect, test } from '@playwright/test';

import { openRace } from '../fixtures.ts';

// The 2025 Las Vegas race (9858): Russell on fresh tyres closing on Leclerc after his stop on
// lap 17, and Leclerc right behind Piastri on lap 38.

test('the Race layout shows the fights and the Battle layout the pace now and the duel', async ({
	page
}) => {
	await openRace(page, '/session?session=9858&lap=22');

	const fights = page.getByTestId('fights');
	await expect(fights.getByTestId('fight-row').first()).toBeVisible({ timeout: 20_000 });
	await expect(fights).toContainText(/\d+ now, \d+ coming/);

	const russell = fights.getByTestId('fight-row').filter({ hasText: 'RUS' }).filter({
		hasText: 'LEC'
	});

	await expect(russell).toContainText('Stopped 4 laps ago');
	await expect(russell).toContainText('in 2 to 3 laps');

	// Picking a fight marks its two cars in the tower and puts them in the duel.
	await russell.click();
	await expect(russell).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('timing-row-RUS')).toHaveAttribute('data-paired', 'true');
	await expect(page.getByTestId('timing-row-LEC')).toHaveAttribute('data-paired', 'true');

	// The Battle tab, third of the race day's tabs, holds the pace and the duel.
	await page.keyboard.press('3');

	const pace = page.getByTestId('pace-now');
	await expect(pace.getByTestId(/^pace-row-/).first()).toBeVisible();
	await expect(pace).toContainText('Fastest');

	await expect(page.getByTestId('duel-verdict')).toContainText('RUS');
	await expect(page.getByTestId('duel-verdict')).toContainText(/s a lap faster|matched on pace/);
});

test('the duel opens on the closest fight with laps to compare', async ({ page }) => {
	// Hamilton, closest to Alonso, stopped too lately to compare; Albon on Colapinto has the laps.
	await openRace(page, '/d/battle?session=9858&lap=30');

	await expect(page.getByTestId('duel-verdict')).toHaveText(
		'ALB is 0.21 s a lap faster over the last 4 laps and 0.4 s behind: in DRS range now.',
		{ timeout: 20_000 }
	);
});

test('two tower rows picked with Shift give the duel’s verdict', async ({ page }) => {
	await openRace(page, '/session?session=9858&lap=38');

	// The tower has loaded once the fights list its rows.
	await expect(page.getByTestId('fights').getByTestId('fight-row').first()).toBeVisible({
		timeout: 20_000
	});
	await page.getByTestId('timing-row-PIA').click({ modifiers: ['Shift'] });
	await page.getByTestId('timing-row-LEC').click({ modifiers: ['Shift'] });
	// The tab key reads the URL as it is: pressed before the pick lands there, it drops the duel.
	await expect(page).toHaveURL(/duel=(PIA|LEC)(%2C|,)(PIA|LEC)/);
	await page.keyboard.press('3');

	await expect(page.getByTestId('duel-verdict')).toHaveText(
		'LEC is 0.28 s a lap faster over the last 5 laps and 0.2 s behind: in DRS range now.'
	);
	await expect(page).toHaveURL(/duel=(PIA|LEC)(%2C|,)(PIA|LEC)/);
	// Shift picks; it does not open the driver.
	await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('the replay shows nothing past the lap it is on', async ({ page }) => {
	await openRace(page, '/d/battle?session=9858&lap=22&duel=VER,NOR');

	const chart = page.getByTestId('duel-chart');
	await expect(chart.locator('text', { hasText: /^L22$/ })).toBeVisible({ timeout: 20_000 });
	// Verstappen stopped on lap 25: no stop mark, lap or later pace before the replay gets there.
	await expect(chart.locator('text', { hasText: /^L(2[3-9]|[3-5]\d)$/ })).toHaveCount(0);

	const verdict = await page.getByTestId('duel-verdict').textContent();

	await page.getByTestId('lap-counter').waitFor();
	await page.goto('/d/battle?session=9858&lap=40&duel=VER,NOR');
	await expect(page.getByTestId('duel-verdict')).not.toHaveText(verdict ?? '');
	await expect(page.getByTestId('duel-chart').locator('text', { hasText: /^L40$/ })).toBeVisible();
});
