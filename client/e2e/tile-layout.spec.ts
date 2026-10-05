import { LAYOUT_SIZES, expectNoLayoutFaults } from './layout-faults.ts';
import { test } from './fixtures.ts';

const TABS = ['/session', '/strategy', '/analysis', '/d/battle'];

// A session tab is laid out so that no tile crowds another and nothing is cut: a list ends on a
// whole row (the rest scrolls inside it) and a note that does not fit is left out.
for (const size of LAYOUT_SIZES) {
	test(`no tile overlaps, overflows or cuts a row at ${size.width}x${size.height}`, async ({
		page
	}) => {
		await expectNoLayoutFaults(page, size, TABS);
	});
}
