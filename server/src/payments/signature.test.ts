import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { WebhookSignatureError } from './provider.js';
import { SIGNATURE_TOLERANCE_SECONDS, signPayload, verifySignature } from './signature.js';

const SECRET = 'whsec-unit-test-only';

const PAYLOAD = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });

const NOW = 1_790_000_000;

describe('webhook signatures', () => {
	it('accepts a payload signed with the shared secret', () => {
		assert.doesNotThrow(() =>
			verifySignature(PAYLOAD, signPayload(PAYLOAD, SECRET, NOW), SECRET, NOW + 5)
		);
	});

	it('accepts any one matching signature, as during a secret rotation', () => {
		const header = `${signPayload(PAYLOAD, 'old-secret', NOW)},v1=${signPayload(PAYLOAD, SECRET, NOW).split('v1=')[1]}`;

		assert.doesNotThrow(() => verifySignature(PAYLOAD, header, SECRET, NOW));
	});

	it('refuses a changed payload, another secret, a missing or malformed header', () => {
		const header = signPayload(PAYLOAD, SECRET, NOW);

		for (const [payload, given, secret] of [
			[PAYLOAD.replace('evt_1', 'evt_2'), header, SECRET],
			[PAYLOAD, header, 'another-secret'],
			[PAYLOAD, undefined, SECRET],
			[PAYLOAD, 'v1=abc', SECRET],
			[PAYLOAD, `t=${NOW},v1=zz`, SECRET]
		] as const) {
			assert.throws(() => verifySignature(payload, given, secret, NOW), WebhookSignatureError);
		}
	});

	it('refuses a delivery replayed after the tolerance', () => {
		const header = signPayload(PAYLOAD, SECRET, NOW);

		assert.doesNotThrow(() =>
			verifySignature(PAYLOAD, header, SECRET, NOW + SIGNATURE_TOLERANCE_SECONDS)
		);
		assert.throws(
			() => verifySignature(PAYLOAD, header, SECRET, NOW + SIGNATURE_TOLERANCE_SECONDS + 1),
			/tolerance/
		);
	});
});
