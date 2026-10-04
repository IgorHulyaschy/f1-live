import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, type Page, test } from '@playwright/test';

import { docShot, openDocs, type Theme } from './docs.ts';

// One picture per kind of question Ask answers, in docs/tour/ask-kinds, over the saved 2025 Las
// Vegas race with the results index of 2018 to 2026. Each test name carries the question typed.
// Needs the docs-real project. docs-real-ask.spec.ts holds the pictures of the Ask tour page itself.

test.use({ timezoneId: 'UTC', locale: 'en-GB' });

/** A day the fixture has seen 2026 qualifying and 2025 finished: nothing is "live". */
const NOW = '2026-10-03T12:00:00.000Z';

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

/** Types `question` into Ask as Cmd+K opens it, and waits for its answer to settle. */
async function openAnswer(
	page: Page,
	question: string,
	{ theme = 'dark', contains, now = NOW }: { theme?: Theme; contains: string; now?: string }
): Promise<void> {
	await serveStewards(page);
	await page.addInitScript(() => {
		// The placeholder stops cycling; a seeded random keeps the example questions the same.
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
	await openDocs(page, '/session?session=9858', { theme, now });
	await expect(page.getByTestId('lap-counter')).toBeAttached();
	await page.keyboard.press('Control+k');

	const dialog = page.getByRole('dialog');

	await expect(dialog).toBeVisible();
	await page.getByTestId('ask-input').fill(question);
	await expect(page.getByTestId('ask-answer')).toContainText(contains, { timeout: 15_000 });
	await expect(page.getByTestId('ask-proof')).toBeVisible();

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

/** The dialog from its top, the typed question included, to the proof link under the answer. */
async function answerRegion(page: Page, margin = 24) {
	const dialog = await page.getByRole('dialog').boundingBox();
	const proof = await page.getByTestId('ask-proof').boundingBox();

	if (!dialog || !proof) {
		throw new Error('The answer is not on screen');
	}

	const top = Math.max(0, dialog.y - margin);

	return {
		x: Math.max(0, dialog.x - margin),
		y: top,
		width: dialog.width + 2 * margin,
		height: proof.y + proof.height + 4 - top
	};
}

/** Takes the picture of the answer and checks the proof link under it names where it leads. */
async function shootAndProve(page: Page, name: string, proofLabel: RegExp): Promise<void> {
	await expect(page.getByTestId('ask-proof')).toContainText(proofLabel);
	await docShot(page, 'ask-kinds', name, await answerRegion(page));
}

test('results: "las vegas qualifying 2025"', async ({ page }) => {
	await openAnswer(page, 'las vegas qualifying 2025', { contains: 'Las Vegas' });
	await shootAndProve(page, 'results-qualifying', /Open the session/);
});

test('what happened to a driver: "what happened to russell in bahrain"', async ({ page }) => {
	// The evening of the 2026 Bahrain race, so it is not held back as a result not yet revealed.
	await openAnswer(page, 'what happened to russell in bahrain', {
		contains: 'Russell retired on lap 50',
		now: '2026-10-04T12:00:00.000Z'
	});
	await shootAndProve(page, 'driver-story', /Open/);
});

test('what happened to a driver: "who has the most dnfs in 2023"', async ({ page }) => {
	await openAnswer(page, 'who has the most dnfs in 2023', { contains: 'retirement' });
	await shootAndProve(page, 'driver-dnfs', /Open the standings/);
});

test('standings: "constructors championship 2021"', async ({ page }) => {
	await openAnswer(page, 'constructors championship 2021', { contains: 'Mercedes' });
	await shootAndProve(page, 'standings-teams', /Open the standings/);
});

test('head to head: "hamilton vs verstappen 2021"', async ({ page }) => {
	await openAnswer(page, 'hamilton vs verstappen 2021', { contains: 'Hamilton' });
	await shootAndProve(page, 'head-to-head-2021', /Open the head to head/);
});

test('stewards: "Why was Antonelli penalised in Las Vegas?"', async ({ page }) => {
	await openAnswer(page, 'Why was Antonelli penalised in Las Vegas?', { contains: 'Antonelli' });
	await shootAndProve(page, 'stewards-antonelli', /Open the FIA document/);
});

test('facts: "How old is Leclerc?"', async ({ page }) => {
	await openAnswer(page, 'How old is Leclerc?', { contains: 'Leclerc is' });
	await expect(
		page.getByTestId('ask-answer').getByRole('link', { name: 'Wikidata' })
	).toBeVisible();
	await shootAndProve(page, 'facts-age', /Open the birth date on Wikidata/);
});

test('pace: "fastest lap in this session"', async ({ page }) => {
	await openAnswer(page, 'fastest lap in this session', { contains: 'fastest lap' });
	await shootAndProve(page, 'pace-fastest-lap', /Open the lap/);
});

test('pace: "tyre strategy in this session"', async ({ page }) => {
	await openAnswer(page, 'tyre strategy in this session', { contains: 'Medium' });
	await shootAndProve(page, 'pace-tyres', /Open the strategy/);
});

test('pace: "who was faster in the second stint, ver or nor"', async ({ page }) => {
	await openAnswer(page, 'who was faster in the second stint, ver or nor', {
		contains: 'a lap quicker than'
	});
	await shootAndProve(page, 'pace-versus', /Open the duel/);
});

test('pace: "race pace ranking"', async ({ page }) => {
	await openAnswer(page, 'race pace ranking', {
		contains: 'Median of the clean laps'
	});
	await shootAndProve(page, 'pace-ranking', /Open the pace tile/);
});

test('pace in the light theme: "sectors in this session"', async ({ page }) => {
	await openAnswer(page, 'sectors in this session', { theme: 'light', contains: 'ector' });
	await shootAndProve(page, 'pace-sectors-light', /Open the analysis/);
});
