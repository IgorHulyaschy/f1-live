import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, type Page, test } from '@playwright/test';

import { docShot, openDocs, type Theme } from './docs.ts';

// The pictures of docs/tour/ask: the Ask palette over a saved race (2025 Las Vegas) with the
// results index of 2018 to 2026. Needs the docs-real project (`npm run docs:shots`).

test.use({ timezoneId: 'UTC', locale: 'en-GB' });

/** A day the fixture has seen 2026 qualifying and 2025 finished: nothing is "live". */
const NOW = '2026-10-03T12:00:00.000Z';

/** Two days after Las Vegas 2025: its race is recent and unseen, so protection holds it back. */
const JUST_AFTER_VEGAS = '2025-11-24T12:00:00.000Z';

const mock = (file: string) =>
	readFileSync(fileURLToPath(new URL(`../src/data/mock/${file}`, import.meta.url)), 'utf8');

/**
 * The committed fixture holds no stewards' documents or Wikidata facts, so the sample ones of the
 * mock replay (a few real decisions of the 2025 season) answer those two requests.
 */
async function serveStewards(page: Page): Promise<void> {
	await page.route('**/decisions/*.json', (route) =>
		route.request().url().endsWith('/2025.json')
			? route.fulfill({ contentType: 'application/json', body: mock('decisions-2025.json') })
			: route.fulfill({ status: 404 })
	);
	await page.route('**/facts.json', (route) =>
		route.fulfill({ contentType: 'application/json', body: mock('facts-2025.json') })
	);
}

/** Opens Ask as Cmd+K does, with the same suggestions and placeholder on every run. */
async function openAsk(
	page: Page,
	question: string,
	{
		theme = 'dark',
		spoilers = false,
		now = NOW
	}: { theme?: Theme; spoilers?: boolean; now?: string } = {}
): Promise<void> {
	await serveStewards(page);
	await page.addInitScript(() => {
		// A seeded random picks the four example questions; the placeholder stops cycling.
		let seed = 7;

		Math.random = () => {
			seed = (seed * 16807) % 2147483647;

			return seed / 2147483647;
		};

		const interval = window.setInterval.bind(window);

		// SAFETY: the stand-in returns what setInterval returns, a timer id, and forwards every other call.
		window.setInterval = ((handler: TimerHandler, delay?: number, ...rest: unknown[]) =>
			delay === 3500 ? 0 : interval(handler, delay, ...rest)) as typeof window.setInterval;
	});
	await openDocs(page, '/session?session=9858', { theme, spoilers, now });
	await expect(page.getByTestId('lap-counter')).toBeAttached();
	await page.keyboard.press('Control+k');

	const dialog = page.getByRole('dialog');

	await expect(dialog).toBeVisible();

	if (question) {
		await page.getByTestId('ask-input').fill(question);
	} else {
		await expect(page.getByTestId('ask-surprise')).toBeVisible();
	}

	// Once its zoom-in settles.
	await expect
		.poll(async () => {
			const first = await dialog.boundingBox();

			await page.waitForTimeout(150);

			const second = await dialog.boundingBox();

			return JSON.stringify(first) === JSON.stringify(second);
		})
		.toBe(true);
}

const answer = (page: Page) => page.getByTestId('ask-answer');

/**
 * The dialog from its top to the end of the answer's own rows, `margin` pixels around. The list
 * below it (dashboards to add the answer to) scrolls and would end the picture mid-row.
 */
async function answerRegion(page: Page, margin: number) {
	const dialog = await page.getByRole('dialog').boundingBox();
	const last = await page.getByRole('option', { name: 'Share this answer' }).boundingBox();

	if (!dialog || !last) {
		throw new Error('The answer is not on screen');
	}

	return {
		x: Math.max(0, dialog.x - margin),
		y: Math.max(0, dialog.y - margin),
		width: dialog.width + 2 * margin,
		height: last.y + last.height + 12 - Math.max(0, dialog.y - margin)
	};
}

test('Ask opens empty with a question to try', async ({ page }) => {
	await openAsk(page, '');
	await docShot(page, 'ask', 'open-empty', page.getByRole('dialog'), 24);
});

test('a result answers with a table and its proof', async ({ page }) => {
	await openAsk(page, 'who won monza 2024');
	await expect(answer(page)).toContainText('Italian', { timeout: 15_000 });
	await expect(page.getByTestId('ask-proof')).toBeVisible();
	await docShot(page, 'ask', 'result-table', page.getByRole('dialog'), 24);
});

test('a head to head answers with both drivers', async ({ page }) => {
	await openAsk(page, 'norris vs piastri 2024');
	await expect(answer(page)).toContainText('Norris', { timeout: 15_000 });
	await docShot(page, 'ask', 'head-to-head', page.getByRole('dialog'), 24);
});

test('a standings question answers with the table', async ({ page }) => {
	await openAsk(page, 'standings 2025');
	await expect(answer(page)).toContainText('Norris', { timeout: 15_000 });
	await docShot(page, 'ask', 'standings', await answerRegion(page, 24));
});

test('a gap question answers from the standings', async ({ page }) => {
	await openAsk(page, 'how many points is piastri behind in 2025');
	await expect(answer(page)).toContainText('points behind the leader', { timeout: 15_000 });
	await docShot(page, 'ask', 'points-gap', await answerRegion(page, 24));
});

test('a question about an unseen race is held back', async ({ page }) => {
	await openAsk(page, 'who won vegas 2025', { spoilers: true, now: JUST_AFTER_VEGAS });
	await expect(page.getByTestId('ask-held')).toContainText('2025 Las Vegas GP Race', {
		timeout: 15_000
	});
	await expect(page.getByTestId('ask-reveal')).toBeVisible();
	await docShot(page, 'ask', 'held-by-spoiler-protection', page.getByRole('dialog'), 24);
});

test('a penalty answers with the stewards’ document', async ({ page }) => {
	await openAsk(page, 'Why was Norris penalised in Las Vegas?');
	await expect(answer(page)).toContainText('disqualification', { timeout: 15_000 });
	await docShot(page, 'ask', 'stewards-decision', page.getByRole('dialog'), 24);
});

test('an age answers from Wikidata', async ({ page }) => {
	await openAsk(page, 'How old is Alonso?');
	await expect(answer(page)).toContainText('Alonso is', { timeout: 15_000 });
	await expect(answer(page).getByRole('link', { name: 'Wikidata' })).toBeVisible();
	await docShot(page, 'ask', 'wikidata-fact', page.getByRole('dialog'), 24);
});

test('a result in the light theme', async ({ page }) => {
	await openAsk(page, 'who won monza 2024', { theme: 'light' });
	await expect(answer(page)).toContainText('Italian', { timeout: 15_000 });
	await docShot(page, 'ask', 'result-table-light', page.getByRole('dialog'), 24);
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('Ask fills the phone', async ({ page }) => {
		await openAsk(page, 'standings 2021');
		await expect(answer(page)).toContainText('Verstappen', { timeout: 15_000 });
		await docShot(page, 'ask', 'standings-phone', await answerRegion(page, 0));
	});
});
