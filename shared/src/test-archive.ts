import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

/** A stand-in for the live timing archive, for the server tests and the client e2e: serves the files it is given, 403 for the rest. */
export interface TestArchive {
	/** The base URL, as `ARCHIVE_URL` takes it. */
	url: string;
	/** Paths asked for, in order. */
	requests: string[];
	/** Holds every answer until `release`, so a test can watch a fetch under way. */
	hold: () => void;
	release: () => void;
	close: () => Promise<void>;
}

/** `files` maps an archive path such as `2019/<meeting>/<session>/Position.z.jsonStream` to its bytes. */
export async function startTestArchive(
	files: ReadonlyMap<string, Buffer>,
	port = 0
): Promise<TestArchive> {
	const requests: string[] = [];
	let held: (() => void)[] | null = null;

	const server = createServer((request, response) => {
		const name = decodeURIComponent(
			(request.url ?? '').replace(/^\/static\//, '').split('?')[0] ?? ''
		);

		const answer = () => {
			const body = files.get(name);

			if (body === undefined) {
				// What the real archive's S3 bucket says for a key it does not have.
				response
					.writeHead(403, { 'Content-Type': 'application/xml' })
					.end('<Error>AccessDenied</Error>');

				return;
			}

			response.writeHead(200, { 'Content-Length': body.length }).end(body);
		};

		requests.push(name);

		if (held === null) {
			answer();
		} else {
			held.push(answer);
		}
	});

	await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));

	// SAFETY: a server listening on a TCP port reports an AddressInfo.
	return {
		url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/static`,
		requests,
		hold: () => {
			held ??= [];
		},
		release: () => {
			const waiting = held ?? [];

			held = null;
			waiting.forEach((answer) => answer());
		},
		close: () =>
			new Promise((resolve) => {
				server.closeAllConnections();
				server.close(() => resolve());
			})
	};
}
