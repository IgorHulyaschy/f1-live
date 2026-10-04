import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Locator, type Page, test as base } from '@playwright/test';
import { z } from 'zod';

import { serveTestPictures } from './pictures';

const MEDIA_HOSTNAME = 'media.formula1.com';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/**
 * `test` that fails when a page asks a host other than this machine for anything its own
 * `page.route` did not answer: a test must not depend on fia.com, wikidata.org or formula1.com.
 */
export const test = base.extend<{ noOutsideRequests: undefined }>({
	noOutsideRequests: [
		async ({ context }, use) => {
			const outside: string[] = [];

			// A route of the page is tried first; one that falls back reaches this catch-all.
			await context.route(
				(url) => !LOCAL_HOSTS.has(url.hostname),
				(route) => {
					// Pictures are decoration: unless a test serves them, they fail and the drawn fallbacks show.
					if (new URL(route.request().url()).hostname === MEDIA_HOSTNAME) {
						return route.abort();
					}

					outside.push(route.request().url());

					return route.abort();
				}
			);
			await use(undefined);
			expect(outside, 'requests to a host that no route answered').toEqual([]);
		},
		{ auto: true }
	]
});

/**
 * Opens a page of the mock replay as a returning viewer and waits until the race has loaded.
 * formula1.com pictures are refused so every run sees the same drawn fallbacks. Spoiler
 * protection is off unless asked for, so a session opens where the replay last did: tests of the
 * protection itself pass `spoilerProtection`, as a first visit has it.
 */
export async function openRace(
	page: Page,
	path = '/session',
	{ spoilerProtection = false }: { spoilerProtection?: boolean } = {}
): Promise<void> {
	await serveTestPictures(page);
	await page.addInitScript(() => window.localStorage.setItem('pitwall-welcomed', 'true'));

	if (!spoilerProtection) {
		await page.addInitScript(() => window.localStorage.setItem('pitwall-spoiler-free', 'false'));
	}

	await page.goto(path);
	// The bar's menu is on every page once the race has loaded; a popped-out tile has only its lap.
	await expect(
		page.getByTestId('app-menu').or(page.getByTestId('lap-counter')).first()
	).toBeVisible();
}

/** The sign-in link the accounts server would have emailed; the dev mailbox hands it to tests. */
export async function mailedLink(page: Page, email: string): Promise<string> {
	const response = await page.request.get(`/api/dev/mailbox?to=${encodeURIComponent(email)}`);

	expect(response.ok()).toBe(true);

	return z.object({ link: z.url() }).parse(await response.json()).link;
}

/** Signs a browser in the quick way: ask for a link, then open it, as the email would. */
export async function signInWithLink(page: Page, email: string): Promise<void> {
	const origin = new URL(page.url()).origin;

	const asked = await page.request.post('/api/auth/sign-in/magic-link', {
		headers: { origin },
		data: { email, callbackURL: `${origin}/account` }
	});

	expect(asked.ok()).toBe(true);
	await page.goto(await mailedLink(page, email));
	await expect(page.getByRole('button', { name: /^Menu, signed in/ })).toBeAttached();
}

/** Picks an entry from the bar's menu, where the rarely used actions live. */
export async function fromMenu(page: Page, item: string): Promise<void> {
	await page.getByTestId('app-menu').click();
	await page.getByRole('menuitem', { name: item, exact: true }).click();
}

/** A fresh address per run, so a reused accounts server never mixes runs. */
export function testEmail(name: string): string {
	return `${name}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.test`;
}

/** Serious and critical axe violations on the page, one line each; the budget allows none. */
export async function seriousViolations(page: Page): Promise<string[]> {
	// The race number painted behind a driver photo is decoration and hidden from assistive tech;
	// WCAG 1.4.3 sets no contrast for it.
	const results = await new AxeBuilder({ page }).exclude('.plate-number').analyze();

	return results.violations
		.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
		.map(
			(violation) =>
				`${violation.id} (${violation.impact}): ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`
		);
}

/** Buys Pro through the fake provider's checkout, as the account page offers it. */
export async function goPro(page: Page): Promise<void> {
	await page.goto('/account');
	await page.getByTestId('go-pro').click();
	await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
	await page.getByRole('button', { name: 'Pay' }).click();
	await expect(page.getByText('Pro is on')).toBeVisible();
}

/** The sizes every page must fit: a phone, a laptop, a desktop and an ultrawide. */
export const FIT_SIZES = [
	{ width: 360, height: 800 },
	{ width: 1280, height: 720 },
	{ width: 1920, height: 1080 },
	{ width: 3440, height: 1440 }
] as const;

/** No sideways scroll, and each key control on the first screen. */
export async function expectFits(page: Page, controls: readonly Locator[]): Promise<void> {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);

	expect(overflow).toBeLessThanOrEqual(0);

	for (const control of controls) {
		// oxlint-disable-next-line no-await-in-loop -- a few controls, each checked once.
		await expect(control).toBeInViewport();
	}
}
