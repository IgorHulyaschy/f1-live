import { test } from '@playwright/test';

import { expectFits, FIT_SIZES, openRace } from '../fixtures.ts';

for (const size of FIT_SIZES) {
	test(`qualifying fits at ${size.width}×${size.height}`, async ({ page }) => {
		await page.setViewportSize(size);
		await openRace(page, '/session?session=11373&lap=20');

		await expectFits(page, [
			page.getByTestId('live-strip'),
			page.getByRole('button', { name: 'Play replay' })
		]);
	});
}
