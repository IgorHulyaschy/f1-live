import { expect, test } from '@playwright/test';

import { openRace } from '../fixtures.ts';

// The 2025 Las Vegas race (9858), qualifying (9854) and second practice (9852), with the
// telemetry the charts open on (e2e/real/derive-fixtures.ts).

test.describe('the race', () => {
	test('telemetry compares the best laps, then one driver’s laps, with a mini-sector table', async ({
		page
	}) => {
		await openRace(page, '/analysis?session=9858');

		// A cold dev server builds the chart code on first use.
		const telemetry = page.getByTestId('telemetry');
		await expect(telemetry.getByTestId('telemetry-charts')).toBeVisible({ timeout: 20_000 });
		// Verstappen's 1:33.365 on lap 50, the fastest lap of the race.
		await expect(telemetry.getByTestId('telemetry-slot-A')).toContainText('L50 1:33.365');
		await expect(telemetry.getByTestId('telemetry-readout')).toContainText('VER');

		await telemetry.getByRole('radio', { name: 'Laps' }).click();
		await expect(telemetry.getByTestId('telemetry-slot-A')).toContainText('L43 1:34.304');
		await expect(telemetry.getByTestId('telemetry-slot-B')).toContainText('L50');

		await telemetry.getByRole('button', { name: 'Table' }).click();
		await expect(telemetry.getByTestId('data-table').getByRole('row')).toHaveCount(23);
	});

	test('the race trace marks the stops and the virtual safety cars', async ({ page }) => {
		await openRace(page, '/analysis?session=9858');

		await page.getByRole('tab', { name: 'Gap' }).click();

		const chart = page.getByRole('region', { name: 'Race charts' });
		await expect(chart).toContainText('Pit stop');
		await expect(chart).toContainText('VSC');
		await expect(chart.locator('rect[width="7"]').first()).toBeVisible();
	});

	test('the story runs the whole race and jumps to a moment', async ({ page }) => {
		await openRace(page, '/d/story?session=9858');

		const story = page.getByTestId('story');
		await expect(story.getByTestId(/^story-step-/)).toHaveCount(50);

		const moments = story.getByRole('list', { name: 'Key moments, latest first' });
		await expect(moments).toContainText('NOR disqualified after the session');
		await moments.getByRole('button', { name: /ALB out, retired/ }).click();
		await expect(page.getByTestId('lap-counter')).toHaveText('Lap 35/50');
	});

	test('the championship ends as it stood after Las Vegas', async ({ page }) => {
		await openRace(page, '/d/story?session=9858');

		const standings = page.getByTestId('championship').getByRole('listitem');
		await expect(standings.nth(0)).toContainText('NOR');
		await expect(standings.nth(0)).toContainText('390');
		await expect(standings.nth(2)).toContainText('VER');
		await expect(standings.nth(2)).toContainText('366');
	});

	test('Pro strategy explains the stops', async ({ page }) => {
		await openRace(page, '/strategy?session=9858&plan=pro');

		const piastri = page
			.getByTestId('undercut-exchange')
			.filter({ hasText: 'PIA' })
			.filter({ hasText: 'Answers L24' });

		await expect(piastri).toContainText('Gained the place');
		await expect(page.getByTestId('tyre-crossovers')).toContainText('A new medium is quicker');
		await expect(page.getByTestId('pit-cost')).toContainText('21.6 s');
		await expect(page.getByTestId('pit-crews').getByRole('listitem').first()).toContainText(
			'Red Bull Racing'
		);
	});

	test('conditions put the wind on the straights', async ({ page }) => {
		await openRace(page, '/d/story?session=9858&plan=pro');

		const conditions = page.getByTestId('conditions');
		await expect(conditions.locator('svg text').filter({ hasText: /^head/ })).toHaveCount(1);
		await expect(conditions.locator('svg text').filter({ hasText: /^tail/ })).toHaveCount(2);
	});
});

test.describe('qualifying', () => {
	test('telemetry opens on pole; the race tools say they apply to races', async ({ page }) => {
		await openRace(page, '/analysis?session=9854');

		// Norris took pole with 1:47.934.
		await expect(page.getByTestId('telemetry-slot-A')).toContainText('1:47.934');
		await expect(page.getByTestId('telemetry-charts')).toBeVisible({ timeout: 20_000 });
		await expect(page.getByTestId('story').getByTestId('story-ribbon')).toBeVisible();

		await openRace(page, '/strategy?session=9854&plan=pro');

		await Promise.all(
			['undercut', 'pit-cost', 'pit-crews'].map((tile) =>
				expect(page.getByTestId(tile).getByTestId('race-only')).toBeVisible()
			)
		);

		await expect(page.getByTestId('tyre-life-applies')).toBeVisible();

		await openRace(page, '/d/story?session=9854&plan=pro');
		await expect(page.getByTestId('championship').getByTestId('race-only')).toBeVisible();
		await expect(
			page
				.getByTestId('story')
				.getByTestId(/^story-step-/)
				.first()
		).toBeVisible();
		await expect(page.getByTestId('conditions').locator('svg text').first()).toBeVisible();
	});
});

test.describe('practice', () => {
	test('telemetry, the story by minute and the wind work; race tools say so', async ({ page }) => {
		await openRace(page, '/analysis?session=9852');

		await expect(page.getByTestId('telemetry-charts')).toBeVisible({ timeout: 20_000 });

		await openRace(page, '/strategy?session=9852&plan=pro');

		await Promise.all(
			['undercut', 'pit-cost', 'pit-crews'].map((tile) =>
				expect(page.getByTestId(tile).getByTestId('race-only')).toBeVisible()
			)
		);

		// This practice had no run of five clean laps on one compound three times over.
		await expect(page.getByTestId('degradation')).toContainText('Curves show once');

		await openRace(page, '/d/story?session=9852&plan=pro');
		await expect(page.getByTestId('story')).toContainText('fastest lap');
		await expect(page.getByTestId('conditions').locator('svg text').first()).toBeVisible();
		await expect(page.getByTestId('championship').getByTestId('race-only')).toBeVisible();
	});
});
