import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { eventPageUrl, parseEventDocuments, parseEventNames } from './listing.js';

const page = readFileSync(new URL('fixtures/event-page.html', import.meta.url), 'utf8');

describe('FIA document listing', () => {
	it('reads the title, address and time of each document', () => {
		const [points, grid] = parseEventDocuments(page);

		assert.equal(parseEventDocuments(page).length, 3);
		assert.equal(points?.title, 'Doc 61 - Championship Points');
		assert.equal(
			points?.url,
			'https://www.fia.com/system/files/decision-document/2025_las_vegas_grand_prix_-_championship_points.pdf'
		);
		assert.equal(
			grid?.title,
			'Doc 51 - Infringement - Car 5 - Causing a collision with Car 18 in turn 1'
		);
		assert.equal(grid?.published, '23.11.25 06:41');
	});

	it('reads the events of a season page, not its other seasons', () => {
		const html = `<select>
			<option value="/documents/championships/x/season/season-2025-2071">2025</option>
			<option value="/documents/championships/x/season/season-2025-2071/event/Las%20Vegas%20Grand%20Prix">Las Vegas</option>
			<option value="/documents/championships/x/season/season-2025-2071/event/Las%20Vegas%20Grand%20Prix">Las Vegas</option>
		</select>`;

		assert.deepEqual(parseEventNames(html), ['Las Vegas Grand Prix']);
	});

	it('builds the address of an event page', () => {
		assert.match(
			eventPageUrl(2025, 'Las Vegas Grand Prix'),
			/season-2025-2071\/event\/Las%20Vegas%20Grand%20Prix$/
		);
	});
});
