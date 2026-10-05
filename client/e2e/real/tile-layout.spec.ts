import { test } from '@playwright/test';

import { LAYOUT_SIZES, expectNoLayoutFaults } from '../layout-faults.ts';

// The same audit on the real Las Vegas race, whose names and numbers are longer than the mock's.
const TABS = ['/session', '/strategy', '/analysis', '/d/battle'].map(
	(path) => `${path}?session=9858&lap=30`
);

for (const size of LAYOUT_SIZES) {
	test(`no tile overlaps, overflows or cuts a row at ${size.width}x${size.height}`, async ({
		page
	}) => {
		await expectNoLayoutFaults(page, size, TABS);
	});
}
