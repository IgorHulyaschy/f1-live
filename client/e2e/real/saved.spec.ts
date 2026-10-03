import { expect, test } from '@playwright/test';

import { openRace } from '../fixtures.ts';

// The fixture is the 2025 Las Vegas weekend and 2026 Baku qualifying, derived from the official
// timing data (e2e/real/derive-fixtures.ts).

test('the race opens at the flag with the McLaren disqualifications', async ({ page }) => {
	await openRace(page, '/?session=9858');

	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 50/50');

	const rows = page.getByTestId(/^timing-row-/);
	await expect(rows.nth(0)).toHaveAttribute('data-testid', 'timing-row-VER');
	await expect(rows.nth(1)).toHaveAttribute('data-testid', 'timing-row-RUS');
	await expect(rows.nth(2)).toHaveAttribute('data-testid', 'timing-row-ANT');

	for (const code of ['NOR', 'PIA']) {
		const row = page.getByTestId(`timing-row-${code}`);

		// oxlint-disable-next-line no-await-in-loop -- two rows, checked in order.
		await expect(row.getByText('DSQ').first()).toBeVisible();
		// oxlint-disable-next-line no-await-in-loop -- see above.
		await expect(row.getByText('DSQ').first()).toHaveAttribute('title', /plank/);
	}

	// Behind the disqualified McLarens, each car is measured to the car now ahead of it.
	await expect(page.getByTestId('timing-row-RUS')).toContainText('23.546');
	await expect(page.getByTestId('timing-row-ANT')).toContainText('6.942');
	await expect(rows.nth(18)).toHaveAttribute('data-testid', 'timing-row-NOR');
	await expect(rows.nth(19)).toHaveAttribute('data-testid', 'timing-row-PIA');
	await expect(page.getByTestId('timing-row-STR').getByText('DNF').first()).toBeVisible();
});

test('a replayed lap shows the order on that lap, not the final one', async ({ page }) => {
	await openRace(page, '/?session=9858&lap=10');

	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 10/50');
	await expect(page.getByTestId('timing-row-NOR').getByText('DSQ')).toHaveCount(0);
});

test('stints and pit stops come from the real strategies', async ({ page }) => {
	await openRace(page, '/strategy?session=9858');

	const stints = page.getByTestId('stint-timeline');
	await expect(stints).toBeVisible();
	await expect(stints).toContainText('L50 of 50');

	const stops = page.getByTestId('pit-stops');
	await expect(stops).toContainText(/\d+ so far/);
	await expect(stops.getByRole('listitem').first()).toBeVisible();
});

test('the session picker opens another session and keeps it in the address', async ({ page }) => {
	await openRace(page, '/?session=9858');

	await page.getByRole('button', { name: 'Sessions' }).click();

	const picker = page.getByTestId('session-picker');
	await expect(picker.getByRole('button', { name: /Las Vegas/ })).toBeVisible();
	await expect(picker.getByTestId('session-9851')).toBeDisabled();
	await picker.getByTestId('session-9854').click();

	await expect(page).toHaveURL(/session=9854/);
	// The screen moves to the qualifying layout with the session.
	await expect(page.getByTestId('strip-session')).toContainText('Qualifying');
	await expect(page.getByTestId('dashboard-quali')).toBeVisible();

	await page.getByRole('button', { name: 'Sessions' }).click();
	await page.getByRole('radio', { name: '2026' }).click();
	await expect(picker.getByRole('button', { name: /Azerbaijan/ })).toBeVisible();
	await picker.getByTestId('session-11373').click();
	await expect(page).toHaveURL(/session=11373/);
});

test('⌘K finds a session by name', async ({ page }) => {
	await openRace(page, '/?session=9858');

	await page.keyboard.press('Control+k');
	await page.getByPlaceholder('Driver, dashboard, session or lap…').fill('Baku qualifying');
	await page.keyboard.press('Enter');

	await expect(page).toHaveURL(/session=11373/);
});

test('qualifying is ordered by best lap, with the knockout lines', async ({ page }) => {
	await openRace(page, '/?session=9854');

	const rows = page.getByTestId(/^timing-row-/);
	await expect(rows.nth(0)).toHaveAttribute('data-testid', 'timing-row-NOR');
	await expect(rows.nth(1)).toHaveAttribute('data-testid', 'timing-row-VER');
	await expect(rows.nth(2)).toHaveAttribute('data-testid', 'timing-row-SAI');
	await expect(rows.nth(0)).toContainText('Fastest');
	await expect(page.getByTestId('cut-line')).toHaveCount(2);
	await expect(page.getByTestId('knockout')).toContainText('Out in Q2');
	await expect(page.getByTestId('tile-away')).toHaveCount(0);
});

test('a 22-car qualifying session cuts after 16 and shows no DRS', async ({ page }) => {
	await openRace(page, '/?session=11373');

	const rows = page.getByTestId(/^timing-row-/);
	await expect(rows).toHaveCount(22);
	await expect(rows.nth(0)).toHaveAttribute('data-testid', 'timing-row-RUS');

	const line = page.getByTestId('cut-line').last();
	await expect(rows.nth(15)).toHaveAttribute('data-testid', 'timing-row-ANT');
	await expect(line).toBeAttached();
	await expect(page.getByText('DRS', { exact: true })).toHaveCount(0);
});

test('a finished race opens at the start, paused, with its results hidden', async ({ page }) => {
	await openRace(page, '/?session=9858', { spoilerProtection: true });

	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 1/50');
	await expect(page.getByTestId('spoiler-start')).toContainText('Results hidden');
	await expect(page.getByRole('button', { name: 'Play replay' })).toBeEnabled();
	await expect(page.getByText('DSQ')).toHaveCount(0);
	await expect(page).toHaveTitle('Las Vegas 2025 Race · Pitwall');

	await page.getByRole('button', { name: 'Jump to the finish (shows results)' }).first().click();

	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 50/50');
	await expect(page.getByTestId('timing-row-NOR').getByText('DSQ').first()).toBeVisible();
	await expect(page.getByTestId('spoiler-start')).toHaveCount(0);

	// The reveal is remembered.
	await page.reload();
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 50/50');
});

test('qualifying opens at the start of Q1 with no pole anywhere until revealed', async ({
	page
}) => {
	await openRace(page, '/?session=11373', { spoilerProtection: true });

	await expect(page.getByTestId('strip-part')).toHaveText('Q1');
	await expect(page.getByTestId('spoiler-start')).toContainText('the start of Q1');
	await expect(page.getByTestId('knockout')).not.toContainText('Pole');
	await expect(page.getByTestId('knockout')).not.toContainText('RUS');

	await page.goto('/library?session=11373');
	await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
	await expect(page.getByText('Pole', { exact: true })).toHaveCount(0);

	await page.goto('/?session=11373');
	await page.getByRole('button', { name: 'Sessions' }).click();
	const picker = page.getByTestId('session-picker');
	await expect(picker.getByTestId('session-11373')).toContainText('Results hidden');
	await expect(picker).not.toContainText('RUS');

	// The picker's own reveal opens the session at its finish.
	await picker.getByTestId('show-results-11373').click();
	await expect(page.getByTestId('strip-part')).toHaveText('Q3');
	await expect(page.getByTestId('knockout')).toContainText('Pole');
});

test('a link with a position opens there, and one without follows the spoiler rule', async ({
	page
}) => {
	await openRace(page, '/?session=9858&lap=30', { spoilerProtection: true });
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 30/50');

	await page.goto('/?session=9854');
	await expect(page.getByTestId('strip-part')).toHaveText('Q1');
});

test('watching to the end reveals the session', async ({ page }) => {
	await openRace(page, '/?session=9858&lap=49', { spoilerProtection: true });

	await page.getByRole('button', { name: 'Next lap' }).click();
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 50/50');

	await page.goto('/?session=9858');
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 50/50');
});

test('spoiler protection off opens finished sessions at the end again', async ({ page }) => {
	await openRace(page, '/?session=9858', { spoilerProtection: true });
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 1/50');

	await page.getByRole('button', { name: 'Sessions' }).click();
	await page.getByRole('switch', { name: 'Spoiler protection' }).click();
	await page.keyboard.press('Escape');
	await page.goto('/?session=11373');

	await expect(page.getByTestId('strip-part')).toHaveText('Q3');
	await expect(page.getByTestId('spoiler-start')).toHaveCount(0);
});

test('a session without saved data still opens, with every panel saying why it is empty', async ({
	page
}) => {
	await openRace(page, '/?session=9851');

	await expect(page.getByTestId('strip-session')).toContainText('Practice 1');
	await expect(page.getByTestId('empty-note').first()).toContainText('has no timing');
	await expect(page.getByTestId('timing-table')).toHaveCount(0);
});

test('with nothing live, the strip counts down to the next session in local time', async ({
	page
}) => {
	await page.clock.setFixedTime(new Date('2025-11-21T12:00:00.000Z'));
	await openRace(page, '/?session=9852');

	const next = page.getByTestId('strip-next');

	await expect(page.getByTestId('live-key')).toHaveText('Replay');
	await expect(next).toContainText('Las Vegas Practice 3');
	await expect(next).toContainText('12 h 30 min');
	await expect(page.getByTestId('dashboard-practice')).toBeVisible();
	await expect(page.getByTestId('long-runs')).toBeVisible();
});

test('a qualifying driver view shows their runs and laps, and a lap its telemetry', async ({
	page
}) => {
	await openRace(page, '/?session=11373&lap=62');

	await page.getByTestId('timing-row-RUS').click();

	const sheet = page.getByTestId('drill-sheet');
	await expect(page).toHaveURL(/car=63/);
	await expect(sheet.getByTestId('drill-runs')).toContainText('Q3 run 1');
	await expect(sheet.getByTestId('drill-headline')).toContainText('1:42.526');

	await sheet.getByTestId('drill-lap-26').click();
	await expect(sheet.getByTestId('lap-facts')).toContainText('1:42.526');
	await expect(sheet.getByTestId('telemetry-charts')).toBeVisible();

	await sheet.getByRole('combobox', { name: 'Compare with driver' }).click();
	await page.getByRole('option', { name: 'LEC' }).click();
	await expect(page).toHaveURL(/vs=16/);
	await expect(sheet.getByTestId('telemetry-readout')).toContainText('LEC');
});

test('with results hidden, a driver view shows only what has happened so far', async ({ page }) => {
	await openRace(page, '/?session=11373&car=63', { spoilerProtection: true });

	const sheet = page.getByTestId('drill-sheet');
	await expect(sheet.getByTestId('driver-view')).toBeVisible();
	await expect(sheet).not.toContainText('Q3');
	await expect(sheet).not.toContainText('1:42.526');

	// Back from a view that came with the link lands on the session, still in the app.
	await page.goBack();
	await expect(sheet).toHaveCount(0);
	await expect(page).toHaveURL(/session=11373$/);
});
