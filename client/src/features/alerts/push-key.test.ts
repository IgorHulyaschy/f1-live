import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { urlBase64ToBytes } from './push-key.ts';

describe('urlBase64ToBytes', () => {
	it('reads URL-safe base64 with or without padding', () => {
		// 0xfb 0xff 0xfe is "+//+" in standard base64 and "-__-" in the URL-safe form.
		assert.deepEqual([...urlBase64ToBytes('-__-')], [0xfb, 0xff, 0xfe]);
		assert.deepEqual([...urlBase64ToBytes('AQI')], [1, 2]);
		assert.deepEqual([...urlBase64ToBytes('AQI=')], [1, 2]);
	});

	it('turns a real VAPID public key into the 65 bytes of an uncompressed P-256 point', () => {
		const key =
			'BCQWSy7bfuvkHOTprtd3ljSfgN00JeofA9WNSneCyXUe-HOBUJgwb0-2QHzGRoAddgOTDie1CrPe3IR77FC_PjI';

		const bytes = urlBase64ToBytes(key);

		assert.equal(bytes.length, 65);
		assert.equal(bytes[0], 4);
	});
});
