import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import webpush from 'web-push';

/**
 * Makes a pair of VAPID keys for Web Push alerts and prints them as environment lines. With
 * `--write`, adds them to server/.env unless it already sets them. No account is involved: the
 * keys only prove to the browsers' push services that the same server sends every notice.
 *
 *   npm run vapid -w server
 *   npm run vapid -w server -- --write
 */
const ENV_FILE = path.resolve(fileURLToPath(import.meta.url), '../../../.env');

const keys = webpush.generateVAPIDKeys();

const lines = [`VAPID_PUBLIC_KEY=${keys.publicKey}`, `VAPID_PRIVATE_KEY=${keys.privateKey}`];

if (!process.argv.includes('--write')) {
	process.stdout.write(
		`${lines.join('\n')}\n\nSet VAPID_SUBJECT to a mailto: address or https URL that reaches whoever runs this server.\n`
	);
} else if (
	existsSync(ENV_FILE) &&
	/^VAPID_(PUBLIC|PRIVATE)_KEY=\S/m.test(readFileSync(ENV_FILE, 'utf8'))
) {
	process.stderr.write(
		`${ENV_FILE} already sets VAPID keys; change them by hand, since a new pair drops every subscription.\n`
	);
	process.exitCode = 1;
} else {
	appendFileSync(ENV_FILE, `\n${lines.join('\n')}\n`, { mode: 0o600 });
	process.stdout.write(`Added the keys to ${ENV_FILE}\n`);
}
