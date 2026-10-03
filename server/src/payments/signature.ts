import { createHmac, timingSafeEqual } from 'node:crypto';

import { WebhookSignatureError } from './provider.js';

/**
 * Webhook signatures in Stripe's scheme: `t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.payload">`.
 * The timestamp is signed too, so a captured delivery cannot be replayed after the tolerance.
 */

export const SIGNATURE_TOLERANCE_SECONDS = 300;

export function signPayload(payload: string, secret: string, timestamp: number): string {
	return `t=${timestamp},v1=${hmac(payload, secret, timestamp)}`;
}

export function verifySignature(
	payload: string,
	header: string | undefined,
	secret: string,
	now: number
): void {
	if (!header) {
		throw new WebhookSignatureError('No signature header');
	}

	const parts = header.split(',').map((part) => part.split('='));
	const timestamp = Number(parts.find(([key]) => key === 't')?.[1]);
	const signatures = parts.flatMap(([key, value]) => (key === 'v1' && value ? [value] : []));

	if (!Number.isInteger(timestamp) || signatures.length === 0) {
		throw new WebhookSignatureError('Malformed signature header');
	}

	if (Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
		throw new WebhookSignatureError('Signature timestamp is outside the tolerance');
	}

	const expected = Buffer.from(hmac(payload, secret, timestamp), 'hex');

	const matches = signatures.some((signature) => {
		const given = Buffer.from(signature, 'hex');

		return given.length === expected.length && timingSafeEqual(given, expected);
	});

	if (!matches) {
		throw new WebhookSignatureError('Signature does not match');
	}
}

function hmac(payload: string, secret: string, timestamp: number): string {
	return createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
}
