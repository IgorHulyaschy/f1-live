import { expect, type Locator, type Page } from '@playwright/test';

import { openRace, test } from './fixtures.ts';

/** A returning viewer with spoiler protection off, on a page that is not the session. */
async function open(page: Page, path: string): Promise<void> {
	await page.route('https://media.formula1.com/**', (route) => route.abort());
	await page.addInitScript(() => window.localStorage.setItem('pitwall-welcomed', 'true'));
	await page.addInitScript(() => window.localStorage.setItem('pitwall-spoiler-free', 'false'));
	await page.goto(path);
}

/** The link names a decision document on fia.com; the test never follows it. */
async function expectFiaDocument(link: Locator): Promise<void> {
	await expect(link).toHaveAttribute('href', /^https:\/\/www\.fia\.com\/.+\.pdf$/);
	await expect(link).toHaveAccessibleName(/\S/);
}

test('race control lists the stewards’ documents with a link to each document', async ({
	page
}) => {
	await openRace(page);

	const documents = page.getByTestId('stewards-documents');

	await expect(documents).toBeVisible();
	await expect(documents).toContainText('Lando Norris');
	await expect(documents).toContainText('disqualification');
	await expectFiaDocument(documents.getByTestId('decision-link').first());
});

test('a driver page shows facts and penalties with their documents', async ({ page }) => {
	await open(page, '/drivers/lando-norris');

	const facts = page.getByTestId('driver-facts');

	await expect(facts).toContainText('Born');
	await expect(facts).toContainText('Wikidata');

	const penalties = page.getByTestId('driver-penalties');

	await expect(penalties).toContainText('Las Vegas');
	await expect(penalties).toContainText('disqualification');
	await expectFiaDocument(penalties.getByTestId('decision-link').first());
});

test('a penalty is held back while the race is unrevealed', async ({ page }) => {
	await page.route('https://media.formula1.com/**', (route) => route.abort());
	await page.addInitScript(() => window.localStorage.setItem('pitwall-welcomed', 'true'));
	// Two days after the race: inside the window in which a finished session is still held back.
	await page.clock.setFixedTime(new Date('2025-11-25T12:00:00Z'));
	await page.goto('/drivers/lando-norris');

	await expect(page.getByTestId('driver-facts')).toBeVisible();
	await expect(page.getByTestId('held-penalties')).toContainText('held back');
});

test('ask answers a penalty and an age with their proof', async ({ page }) => {
	await open(page, '/');
	await page.getByTestId('home-ask').click();

	const answer = page.getByTestId('ask-answer');

	await page.getByTestId('ask-input').fill('Why was Norris penalised in Las Vegas?');

	await expect(answer).toContainText('disqualification', { timeout: 15_000 });
	await expectFiaDocument(answer.getByRole('link').nth(1));

	await page.getByTestId('ask-input').fill('How old is Alonso?');

	await expect(answer).toContainText('Alonso is');
	await expect(answer.getByRole('link', { name: 'Wikidata' })).toHaveAttribute(
		'href',
		/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+$/
	);
});
