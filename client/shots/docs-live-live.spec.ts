import { expect, type Page, test } from '@playwright/test';

import { replaying } from '../e2e/live/replay.ts';
import { docShot, openDocs, type Theme } from './docs.ts';

/**
 * The pictures of docs/tour/live: 2026 Baku qualifying replayed through the live path at 150x, as
 * a session that is running. The replay ends with Q1 still running and six cars without a time.
 */

// One replay owns the live port, so every picture of this file runs in the same worker.
test.describe.configure({ mode: 'serial' });

replaying('2026-baku-qualifying', 150);

/**
 * The session clock of a live screen runs on after the replay has ended (the replay's own clock
 * keeps going at 150x), so what it reads depends on when the page loaded. The picture holds it at
 * the time left when the replay ends, which is what the screen reads for the first seconds.
 */
const TIME_LEFT = '10:52';

/**
 * A page that opens after the replay has ended has no feed time to follow and counts from its own
 * clock, which moves the estimated cars on the map; pinned, the cars stand where they stood on
 * every run.
 */
const NOW = '2026-10-03T12:00:00Z';

/** Toasts of the replayed events pile up over the Replay tile and differ from run to run. */
async function hideToasts(page: Page): Promise<void> {
	await page.addStyleTag({ content: '[data-sonner-toaster] { display: none !important; }' });
}

async function holdClock(page: Page): Promise<void> {
	await page.evaluate((held) => {
		const hold = () => {
			for (const reading of document.querySelectorAll('[data-testid="strip-time"] .font-mono')) {
				if (reading.textContent !== held) {
					reading.textContent = held;
				}
			}
		};

		new MutationObserver(hold).observe(document.body, {
			subtree: true,
			childList: true,
			characterData: true
		});
		hold();
	}, TIME_LEFT);
}

/** The Quali layout once the session has shown its end state: the part, the clock and the drop zone. */
async function openLiveQuali(page: Page, theme: Theme = 'dark'): Promise<void> {
	await openDocs(page, '/session', { theme, now: NOW });
	await hideToasts(page);

	await expect(page.getByTestId('tile-replay').getByTestId('live-key')).toHaveText('Live', {
		timeout: 30_000
	});
	await expect(page.getByTestId('live-strip').getByTestId('strip-part')).toHaveText('Q1', {
		timeout: 30_000
	});
	await expect(page.getByTestId('drop-zone')).toContainText('STR', { timeout: 30_000 });
	await expect(page.getByTestId(/^timing-row-/).first()).toHaveAttribute(
		'data-testid',
		'timing-row-HAD'
	);
	await expect(page.locator('[data-drop-zone]')).toHaveCount(6);
	await holdClock(page);
}

/** The right-hand end of the bar: the session, its part, the clock and the keys beside them. */
async function barRegion(page: Page) {
	const header = await page.getByRole('banner').boundingBox();
	const strip = await page.getByTestId('live-strip').boundingBox();

	if (!header || !strip) {
		throw new Error('The bar is not on screen');
	}

	const viewport = page.viewportSize()?.width ?? 1440;
	const x = Math.max(0, strip.x - 16);

	return { x, y: 0, width: viewport - x, height: Math.round(header.height) };
}

test('the Quali layout while the session is live', async ({ page }) => {
	await openLiveQuali(page);
	await docShot(page, 'live', 'quali-live');
});

test('the Quali layout while the session is live, light', async ({ page }) => {
	await openLiveQuali(page, 'light');
	await docShot(page, 'live', 'quali-live-light');
});

test('the bar names the session and counts the part down', async ({ page }) => {
	await openLiveQuali(page);
	await docShot(page, 'live', 'bar-live', await barRegion(page));
});

test('the live key in the bar, following and after stepping back', async ({ page }) => {
	await openDocs(page, '/d/track', { now: NOW });
	await hideToasts(page);

	const key = page.getByTestId('header-clock').getByTestId('live-key');

	await expect(key).toHaveText('Live', { timeout: 30_000 });
	await holdClock(page);
	await docShot(page, 'live', 'live-key-following', await barRegion(page));
	await page.keyboard.press('ArrowLeft');
	await expect(key).toHaveText('Go live');
	await docShot(page, 'live', 'live-key-go-live', await barRegion(page));
});

test('a saved race on screen while another session is live', async ({ page }) => {
	await openDocs(page, '/session?session=9858', { now: NOW });
	await expect(page.getByTestId('strip-live-elsewhere')).toContainText('Watch live', {
		timeout: 30_000
	});
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 50/50');
	await docShot(page, 'live', 'strip-live-elsewhere', await barRegion(page));
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('the Quali layout while the session is live', async ({ page }) => {
		await openLiveQuali(page);
		await docShot(page, 'live', 'quali-live-phone');
	});
});
