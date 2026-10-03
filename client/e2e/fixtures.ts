import { expect, type Page } from '@playwright/test';
import { z } from 'zod';

/**
 * Opens a page of the mock replay as a returning viewer and waits until the race has loaded.
 * formula1.com pictures are refused so every run sees the same drawn fallbacks.
 */
export async function openRace(page: Page, path = '/'): Promise<void> {
	await page.route('https://media.formula1.com/**', (route) => route.abort());
	await page.addInitScript(() => window.localStorage.setItem('pitwall-welcomed', 'true'));
	await page.goto(path);
	await expect(page.getByTestId('lap-counter')).toBeVisible();
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
	await expect(page.getByTestId('account-menu')).toBeAttached();
}

/** A fresh address per run, so a reused accounts server never mixes runs. */
export function testEmail(name: string): string {
	return `${name}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.test`;
}
