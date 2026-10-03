import { expect, test } from '@playwright/test';

import { openRace } from '../fixtures.ts';

// The 2025 Las Vegas race (9858), qualifying (9854) and second practice (9852), with the
// telemetry the charts open on (e2e/real/derive-fixtures.ts).

test.describe('the race', () => {
	test('telemetry compares the best laps, then one driver’s laps, with a mini-sector table', async ({
		page
	}) => {
		await openRace(page, '/analysis?session=9858');

		const telemetry = page.getByTestId('telemetry');
		await expect(telemetry.getByTestId('telemetry-charts')).toBeVisible();
		// Verstappen's 1:33.365 on lap 50, the fastest lap of the race.
		await expect(telemetry.getByTestId('telemetry-slot-A')).toContainText('L50 1:33.365');
		await expect(telemetry.getByTestId('telemetry-readout')).toContainText('VER');

		await telemetry.getByRole('radio', { name: 'Laps' }).click();
		await expect(telemetry.getByTestId('telemetry-slot-A')).toContainText('L43 1:34.304');
		await expect(telemetry.getByTestId('telemetry-slot-B')).toContainText('L50');

		await telemetry.getByRole('button', { name: 'Table' }).click();
		await expect(telemetry.getByTestId('data-table').getByRole('row')).toHaveCount(23);
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
	test('telemetry opens on pole, and the race tools say they apply to races', async ({ page }) => {
		await openRace(page, '/analysis?session=9854');

		// Norris took pole with 1:47.934.
		await expect(page.getByTestId('telemetry-slot-A')).toContainText('1:47.934');
		await expect(page.getByTestId('telemetry-charts')).toBeVisible();

		await openRace(page, '/strategy?session=9854&plan=pro');
		await expect(page.getByTestId('undercut').getByTestId('race-only')).toBeVisible();
		await expect(page.getByTestId('tyre-life-applies')).toBeVisible();
		await expect(page.getByTestId('pit-cost').getByTestId('race-only')).toBeVisible();

		await openRace(page, '/d/story?session=9854');
		await expect(page.getByTestId('championship').getByTestId('race-only')).toBeVisible();
		await expect(
			page
				.getByTestId('story')
				.getByTestId(/^story-step-/)
				.first()
		).toBeVisible();
	});
});

test.describe('practice', () => {
	test('telemetry, the story by minute and the wind work in practice', async ({ page }) => {
		await openRace(page, '/analysis?session=9852');

		await expect(page.getByTestId('telemetry-charts')).toBeVisible();

		await openRace(page, '/d/story?session=9852&plan=pro');
		await expect(page.getByTestId('story')).toContainText('fastest lap');
		await expect(page.getByTestId('conditions').locator('svg text').first()).toBeVisible();
		await expect(page.getByTestId('championship').getByTestId('race-only')).toBeVisible();
	});
});
