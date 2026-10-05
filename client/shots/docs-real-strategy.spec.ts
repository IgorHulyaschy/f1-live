import { expect, type Locator, type Page, test } from '@playwright/test';

import { docShot, openDocs, type Region } from './docs.ts';

// The Strategy dashboard, the Battle gaps, the true pace and the race story on the 2025 Las Vegas
// race (9858), in their final state unless a lap is asked for.

const STRATEGY = '/strategy?session=9858&plan=pro';

const TOP = 64;

/** Waits until every Strategy tile has read the race, the way e2e/real/insights.spec.ts does. */
async function strategyRead(page: Page) {
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 50/50');
	await expect(page.getByTestId('stint-timeline')).toBeVisible();
	await expect(
		page
			.getByTestId('undercut-exchange')
			.filter({ hasText: 'PIA' })
			.filter({ hasText: 'Answers L24' })
	).toContainText('Gained the place');
	await expect(page.getByTestId('tyre-crossovers')).toContainText('A new medium is quicker');
	await expect(page.getByTestId('pit-cost')).toContainText('21.6 s');
	await expect(page.getByTestId('pit-crews').getByRole('listitem').first()).toContainText(
		'Red Bull Racing'
	);
}

/** Scrolls so the tile sits where the first row does. */
async function bring(page: Page, tile: Locator) {
	await tile.scrollIntoViewIfNeeded();

	const box = await tile.boundingBox();

	if (box) {
		await page.evaluate((by) => window.scrollBy(0, by), box.y - TOP);
	}
}

/** The rectangle two tiles share, for a picture of a pair. */
async function around(first: Locator, second: Locator): Promise<Region> {
	const [a, b] = await Promise.all([first.boundingBox(), second.boundingBox()]);

	if (!a || !b) {
		throw new Error('A tile to crop to is not on screen');
	}

	const x = Math.min(a.x, b.x);
	const y = Math.min(a.y, b.y);

	return {
		x,
		y,
		width: Math.max(a.x + a.width, b.x + b.width) - x,
		height: Math.max(a.y + a.height, b.y + b.height) - y
	};
}

test('the Strategy dashboard, tile by tile', async ({ page }) => {
	await openDocs(page, STRATEGY);
	await strategyRead(page);

	await docShot(page, 'strategy', 'stints', page.getByTestId('tile-stints'));

	// The ledger scrolls inside its tile: the picture ends under its first exchange, not mid-row.
	const [undercut, exchange] = await Promise.all([
		page.getByTestId('tile-undercut').boundingBox(),
		page.getByTestId('undercut-exchange').first().boundingBox()
	]);

	if (!undercut || !exchange) {
		throw new Error('The undercut ledger is not on screen');
	}

	await docShot(page, 'strategy', 'undercut-ledger', {
		x: undercut.x,
		y: undercut.y,
		width: undercut.width,
		height: exchange.y + exchange.height + 12 - undercut.y
	});
	await docShot(page, 'strategy', 'tyre-wear', page.getByTestId('tile-degradation'));
	await docShot(page, 'strategy', 'stop-cost', page.getByTestId('tile-pit-cost'));

	const crews = page.getByTestId('tile-pit-crews');

	await bring(page, crews);
	await docShot(page, 'strategy', 'pit-crews', crews);
});

test('the Battle dashboard prices a stop in places', async ({ page }) => {
	await openDocs(page, '/d/battle?session=9858&lap=30&plan=pro');
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 30/50');
	await expect(page.getByTestId('tile-gaps')).toContainText('PIA');
	await expect(page.getByTestId('tile-box-now')).toContainText(/Box now, P\d+/);
	await expect(page.getByTestId('tile-duel')).toBeVisible();

	await docShot(
		page,
		'strategy',
		'battle-gaps-and-box-now',
		await around(page.getByTestId('tile-gaps'), page.getByTestId('tile-box-now'))
	);
	await docShot(
		page,
		'strategy',
		'battle-duel-and-pace',
		await around(page.getByTestId('tile-duel'), page.getByTestId('tile-focus'))
	);
});

test('Analysis ranks the race pace and charts every lap', async ({ page }) => {
	await openDocs(page, '/analysis?session=9858&plan=pro');
	await expect(page.getByTestId('race-pace')).toContainText('Race pace');
	await expect(page.getByTestId('pace-hint')).toBeVisible();
	await expect(page.getByTestId('chart-lapTime')).toBeVisible();
	await expect(page.getByTestId('chart-lapTime')).toContainText('VSC');

	await docShot(page, 'strategy', 'race-pace', page.getByTestId('tile-pace'));
	await docShot(page, 'strategy', 'lap-time-chart', page.getByTestId('tile-chart'));
});

test('two drivers picked in Race pace give the verdict', async ({ page }) => {
	await openDocs(page, '/analysis?session=9858&plan=pro&duel=VER,NOR');
	await expect(page.getByTestId('pace-verdict')).toContainText('a lap quicker than');

	await docShot(page, 'strategy', 'race-pace-pair', page.getByTestId('tile-pace'));
});

test('the race story, flags to retirements, lane by lane', async ({ page }) => {
	await openDocs(page, '/d/story?session=9858&plan=pro');

	const story = page.getByTestId('story');

	await expect(story.getByTestId(/^story-step-/)).toHaveCount(50);

	const moments = story.getByRole('list', { name: 'Key moments, latest first' });

	await expect(moments).toContainText('NOR disqualified after the session');

	// The list scrolls inside the tile: the picture ends under its third moment, not mid-row.
	const [tile, third] = await Promise.all([
		page.getByTestId('tile-story').boundingBox(),
		moments.getByRole('button').nth(2).boundingBox()
	]);

	if (!tile || !third) {
		throw new Error('The story is not on screen');
	}

	await docShot(page, 'strategy', 'race-story', {
		x: tile.x,
		y: tile.y,
		width: tile.width,
		height: third.y + third.height + 10 - tile.y
	});
});

test('the Strategy dashboard in the light theme', async ({ page }) => {
	await openDocs(page, STRATEGY, { theme: 'light' });
	await strategyRead(page);

	await docShot(
		page,
		'strategy',
		'tyre-wear-and-stop-cost-light',
		await around(page.getByTestId('tile-degradation'), page.getByTestId('tile-pit-cost'))
	);
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('the stints lead the stack', async ({ page }) => {
		await openDocs(page, STRATEGY);
		await expect(page.getByTestId('stint-timeline')).toBeVisible();
		await expect(page.getByTestId('lap-counter')).toBeAttached();

		await docShot(page, 'strategy', 'strategy-phone', { x: 0, y: 60, width: 390, height: 620 });
	});
});
