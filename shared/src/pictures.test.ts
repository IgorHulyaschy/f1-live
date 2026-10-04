import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { driverImageId, referenceOf, teamFolderOf } from './pictures.ts';

// Driver lists as the archive prints them: 2018 has no headshot, 2023 has the old address, 2025
// the media host's and, in some sessions, the cut-out's own id.
const HEADSHOT_2023 =
	'https://www.formula1.com/content/dam/fom-website/drivers/L/LANNOR01_Lando_Norris/lannor01.png.transform/1col/image.png';

const HEADSHOT_2025 =
	'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/O/OSCPIA01_Oscar_Piastri/oscpia01.png.transform/1col/image.png';

describe('referenceOf', () => {
	it('reads the reference from either headshot address', () => {
		assert.equal(referenceOf(HEADSHOT_2023), 'lannor01');
		assert.equal(referenceOf(HEADSHOT_2025), 'oscpia01');
	});

	it('is undefined without a headshot', () => {
		assert.equal(referenceOf(undefined), undefined);
		assert.equal(referenceOf('https://example.com/a.png'), undefined);
	});
});

describe('teamFolderOf', () => {
	it('writes the team as the host does, from the first season it has pictures for', () => {
		assert.equal(teamFolderOf(2025, 'Red Bull Racing'), 'common/f1/2025/redbullracing');
		assert.equal(teamFolderOf(2024, 'Haas F1 Team'), 'common/f1/2024/haasf1team');
		assert.equal(teamFolderOf(2023, 'McLaren'), null);
		assert.equal(teamFolderOf(2018, 'McLaren'), null);
	});
});

describe('driverImageId', () => {
	it('is the feed id when it has one', () => {
		const publicId = 'common/f1/2025/mclaren/lannor01/2025mclarenlannor01right';

		assert.equal(
			driverImageId({ season: 2025, team: 'McLaren', headshotUrl: HEADSHOT_2025, publicId }),
			publicId
		);
	});

	it('is built from season, team and reference for 2025 without the feed id', () => {
		assert.equal(
			driverImageId({ season: 2025, team: 'McLaren', headshotUrl: HEADSHOT_2025 }),
			'common/f1/2025/mclaren/oscpia01/2025mclarenoscpia01right'
		);
	});

	it('has none for 2023, which keeps the headshot, and none for 2018, which has no picture', () => {
		assert.equal(
			driverImageId({ season: 2023, team: 'McLaren', headshotUrl: HEADSHOT_2023 }),
			undefined
		);
		assert.equal(driverImageId({ season: 2018, team: 'McLaren' }), undefined);
	});
});
