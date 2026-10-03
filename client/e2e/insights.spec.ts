import { expect, test } from '@playwright/test';

import { openRace } from './fixtures.ts';

// The modelled replay of the 2025 Las Vegas race: no passes or radio, but stops, flags,
// penalties, the championship before the race and a few of the real race's laps of telemetry.

test('the timeline jumps to the next pit stop and to the safety car period', async ({ page }) => {
	await openRace(page, '/?lap=10');

	const replay = page.getByRole('region', { name: 'Replay' });
	const note = page.getByTestId('timeline-note');

	await replay.getByRole('radio', { name: 'Stops' }).click();
	await replay.getByRole('button', { name: 'Next event' }).click();
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 13/50');
	await expect(note).toContainText('ALB stops for mediums');

	// The keys move between flags once the filter says so.
	await replay.getByRole('radio', { name: 'Flags' }).click();
	await replay.getByRole('radio', { name: 'Flags' }).blur();
	await page.keyboard.press('Shift+ArrowRight');
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 16/50');
	await expect(note).toContainText('Virtual Safety Car');

	await page.keyboard.press('Shift+ArrowLeft');
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 2/50');

	// A marker says what happened and takes the replay there.
	await expect(replay.getByTestId('timeline-event-16')).toHaveAttribute(
		'title',
		/Virtual Safety Car/
	);
	await replay.getByTestId('timeline-event-16').click();
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 16/50');

	await replay.getByTestId('speed').click();
	await replay.getByTestId('speed').click();
	await expect(replay.getByTestId('speed')).toHaveText('4×');
});

test('the telemetry tile draws the real race’s laps on the modelled replay', async ({ page }) => {
	await openRace(page, '/analysis');

	const telemetry = page.getByTestId('telemetry');
	// A cold dev server builds the chart code and the laps on first use.
	await expect(telemetry.getByTestId('telemetry-charts')).toBeVisible({ timeout: 20_000 });
	await expect(telemetry.getByTestId('telemetry-slot-A')).toContainText('VER');
	await expect(telemetry).toContainText('the real race’s laps');
});

test('the versus chart and the table view', async ({ page }) => {
	await openRace(page, '/analysis');

	await page.getByRole('tab', { name: 'Versus' }).click();
	await expect(page.getByTestId('chart-versus')).toBeVisible();

	const chart = page.getByRole('region', { name: 'Race charts' });
	await chart.getByRole('button', { name: 'Table' }).click();
	await expect(chart.getByTestId('data-table').getByRole('row')).toHaveCount(31);
});

test('the race story dashboard tells the race and the championship', async ({ page }) => {
	await openRace(page, '/d/story?lap=50');

	const story = page.getByTestId('story');
	await expect(story.getByRole('list', { name: 'Key moments, latest first' })).toContainText(
		'ALB out'
	);

	const championship = page.getByTestId('championship');
	await expect(championship.getByRole('list', { name: 'Projected standings' })).toContainText(
		'NOR'
	);
	await expect(championship.getByTestId('place-values')).toBeVisible();
});

test('Pro strategy shows the ledger, tyre curves, stop cost and crews', async ({ page }) => {
	await openRace(page, '/strategy?plan=pro&lap=50');

	await expect(page.getByTestId('undercut-exchange').first()).toBeVisible();
	await expect(page.getByTestId('tyre-life')).toBeVisible();
	await expect(page.getByTestId('pit-cost')).toContainText('Green stop');
	await expect(page.getByTestId('pit-crews')).toContainText('No stop with a stationary time');
});

test('free viewers get a teaser for the ledger', async ({ page }) => {
	await openRace(page, '/strategy?lap=50');

	await expect(page.getByTestId('undercut')).toContainText('The undercut ledger is part of Pro');
	await expect(page.getByTestId('undercut-exchange')).toHaveCount(0);
});
