import { z } from 'zod';

/** Reconnects wait this long, doubling to the cap, with jitter so devices never retry together. */
const BACKOFF_MS = { initial: 1000, max: 30_000 };

const changeSchema = z.object({
	type: z.literal('changed'),
	topic: z.enum(['dashboards', 'viewer'])
});

export type SyncSocketHandlers = {
	open: () => void;
	message: (text: string) => void;
	closed: (code: number) => void;
};

export type SyncSocketLike = { close: () => void };

export type SyncSocketOptions = {
	/** The server's `/api/me/events` address, with this device's id. */
	url: string;
	/** Another device changed the account: pull it. */
	onChange: () => void;
	/** The channel is up or down; a reconnect also pulls, for whatever was missed meanwhile. */
	onOpen: (open: boolean) => void;
	createSocket?: (url: string, handlers: SyncSocketHandlers) => SyncSocketLike;
	random?: () => number;
};

/** The channel's address from the accounts API base; empty means this page's own origin. */
export function eventsUrl(base: string, page: { protocol: string; host: string }, device: string) {
	const origin = base || `${page.protocol}//${page.host}`;
	const url = new URL('/api/me/events', origin);

	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	url.searchParams.set('device', device);

	return url.toString();
}

function browserSocket(url: string, handlers: SyncSocketHandlers): SyncSocketLike {
	const socket = new WebSocket(url);

	socket.addEventListener('open', () => handlers.open());
	socket.addEventListener('message', (event: MessageEvent<string>) => handlers.message(event.data));
	socket.addEventListener('close', (event) => handlers.closed(event.code));
	socket.addEventListener('error', () => socket.close());

	return socket;
}

/** Close code the server uses for "no session": reconnecting would only be refused again. */
const SIGNED_OUT = 4401;

/**
 * The signed-in device channel: the server nudges when another device changes the account, and
 * this reconnects with backoff when it drops. It only carries the nudge; the data is pulled.
 * Returns a function that closes it for good.
 */
export function openSyncSocket(options: SyncSocketOptions): () => void {
	const createSocket = options.createSocket ?? browserSocket;
	const random = options.random ?? Math.random;
	let socket: SyncSocketLike | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let attempt = 0;
	let stopped = false;

	const connect = () => {
		const own: SyncSocketLike = createSocket(options.url, {
			open: () => {
				if (socket !== own) {
					return;
				}

				attempt = 0;
				options.onOpen(true);
				// Anything that changed while this was down is still waiting on the account.
				options.onChange();
			},
			message: (text) => {
				if (socket === own && parse(text)) {
					options.onChange();
				}
			},
			closed: (code) => {
				if (socket !== own) {
					return;
				}

				socket = null;
				options.onOpen(false);

				if (stopped || code === SIGNED_OUT) {
					return;
				}

				const ceiling = Math.min(BACKOFF_MS.max, BACKOFF_MS.initial * 2 ** attempt);

				attempt += 1;
				timer = setTimeout(connect, ceiling / 2 + (ceiling / 2) * random());
			}
		});

		socket = own;
	};

	connect();

	return () => {
		stopped = true;

		if (timer) {
			clearTimeout(timer);
		}

		const current = socket;

		socket = null;
		current?.close();
	};
}

function parse(text: string): boolean {
	try {
		return changeSchema.safeParse(JSON.parse(text)).success;
	} catch {
		return false;
	}
}
