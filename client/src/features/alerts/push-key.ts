/** The server's VAPID public key is URL-safe base64; `subscribe` wants the bytes. */
export function urlBase64ToBytes(key: string): Uint8Array<ArrayBuffer> {
	const padded = key
		.replaceAll('-', '+')
		.replaceAll('_', '/')
		.padEnd(Math.ceil(key.length / 4) * 4, '=');

	const raw = atob(padded);
	const bytes = new Uint8Array(raw.length);

	for (let index = 0; index < raw.length; index += 1) {
		bytes[index] = raw.charCodeAt(index);
	}

	return bytes;
}
