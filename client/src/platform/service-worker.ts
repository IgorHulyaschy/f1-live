/**
 * The offline app shell. The build fills in the files to keep (the page, its scripts, styles,
 * fonts and icons) and a version made from their hashed names, so every deploy installs a fresh
 * cache and drops the old one. Race data and pictures are never cached here: a stale lap is worse
 * than a visible "unavailable".
 */

declare const self: ServiceWorkerGlobalScope;

/** Written in by the build (vite.config.ts): the paths to keep. */
declare const BUILD_SHELL_FILES: readonly string[];

/** Written in by the build: a hash of those paths and the page, new with every deploy. */
declare const BUILD_SHELL_VERSION: string;

const CACHE = `shell-${BUILD_SHELL_VERSION}`;

const PRECACHE = new Set(BUILD_SHELL_FILES);

/** A page request waits this long for the network before the kept shell answers instead. */
const NAVIGATION_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll([...PRECACHE]))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
			)
			.then(() => self.clients.claim())
	);
});

function cachedShell(): Promise<Response | undefined> {
	return caches.match('/', { cacheName: CACHE, ignoreVary: true });
}

/** Every address is the same single-page app, so offline any page opens from the kept shell. */
async function navigate(request: Request): Promise<Response> {
	const network = fetch(request);
	// When the kept shell wins the race, a later network failure is expected, not an error.
	network.catch(() => undefined);

	const slowNetwork = new Promise<Response | undefined>((resolve) => {
		setTimeout(() => void cachedShell().then(resolve), NAVIGATION_TIMEOUT_MS);
	});

	try {
		return (await Promise.race([network, slowNetwork])) ?? (await network);
	} catch {
		return (await cachedShell()) ?? Response.error();
	}
}

/** Kept files have hashed names, so any copy will do, whatever headers the server varied on. */
async function fromCache(request: Request): Promise<Response> {
	return (await caches.match(request, { cacheName: CACHE, ignoreVary: true })) ?? fetch(request);
}

self.addEventListener('fetch', (event) => {
	const { request } = event;

	if (request.method !== 'GET') {
		return;
	}

	const url = new URL(request.url);

	// Sign-in links land on the accounts API, which must answer them itself, however slowly.
	if (url.pathname.startsWith('/api/')) {
		return;
	}

	if (request.mode === 'navigate') {
		event.respondWith(navigate(request));

		return;
	}

	if (url.origin === self.location.origin && PRECACHE.has(url.pathname)) {
		event.respondWith(fromCache(request));
	}
});
