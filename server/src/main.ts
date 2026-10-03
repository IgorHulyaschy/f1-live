import path from 'node:path';

import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { sql } from 'drizzle-orm';
import Fastify, { LogController } from 'fastify';
import type { FastifyInstance } from 'fastify';

import { createAccounts, injectWebhook } from './accounts/accounts.js';
import type { Accounts } from './accounts/accounts.js';
import type { PushSender } from './accounts/alerts/sender.js';
import { registerAccounts } from './accounts/routes.js';
import { isInsecureRelayUrl } from './config.js';
import type { Config } from './config.js';
import { registerHealth } from './http/health.js';
import { registerIngest } from './http/ingest.js';
import { registerLiveSocket } from './http/live-socket.js';
import { registerStaticData } from './http/static-data.js';
import { LiveHub } from './live/hub.js';
import { SessionImporter } from './live/importer.js';
import { LivePipeline } from './live/pipeline.js';
import { RelayChannelPusher, RelayPusher } from './live/relay.js';
import { LiveSession } from './live/session.js';
import { LiveTelemetry } from './telemetry/live.js';
import type { LiveTelemetryOptions } from './telemetry/live.js';
import type { Backoff, EventLog } from './sources/f1/live.js';

const RELAY_BACKOFF: Backoff = { initialMs: 500, maxMs: 15_000 };

const FEED_BACKOFF: Backoff = { initialMs: 1000, maxMs: 30_000 };

const FEED_STATS_INTERVAL_MS = 60_000;

/** Viewers send `resync`, `subscribe` and `unsubscribe`: all short. */
const MAX_VIEWER_MESSAGE_BYTES = 1024;

/** Position and car data frames go to opted-in viewers at most this often: 4 a second. */
const TELEMETRY_INTERVAL_MS = 250;

const PROBE_PATHS: ReadonlySet<string> = new Set(['/health', '/ready']);

export interface ServerOptions {
	/** The clock for the recorder and snapshot frames; a replay runs it on session time. */
	now?: () => number;
	/** Where raw recordings go; defaults to `<DATA_DIR>/raw`. */
	rawDir?: string;
	fetchImpl?: typeof fetch;
	/** Waits between reconnects to the live feed and pushes to the relay; tests shorten them. */
	feedBackoff?: Backoff;
	relayBackoff?: Backoff;
	/** How often an ingest asks the relay which telemetry channels are wanted; tests shorten it. */
	channelProbeMs?: number;
	/** How long a telemetry channel may stay silent before it is no longer live; tests shorten it. */
	channelSilentMs?: number;
	/** Replaces the Web Push client, so a test sees what would be sent. */
	pushSender?: PushSender;
	/** Replaces the importer that runs when a session ends; null turns it off. */
	importer?: SessionImporter | null;
}

export interface LiveServer {
	app: FastifyInstance;
	session: LiveSession;
	hub: LiveHub | undefined;
	/** Starts listening and the background work; resolves to the address. */
	listen: () => Promise<string>;
	close: () => Promise<void>;
}

/** Builds the one server for every mode; nothing runs until `listen`. */
export async function createServer(
	config: Config,
	options: ServerOptions = {}
): Promise<LiveServer> {
	const app = Fastify({
		logger: { level: config.logLevel },
		// Probes hit these every few seconds; logging each would bury the real requests.
		logController: new LogController({
			disableRequestLogging: (request) => PROBE_PATHS.has(request.url)
		})
	});

	const log: EventLog = (event, fields) => app.log.info({ event, ...fields }, event);

	if (config.mode === 'ingest' && config.relay.url && isInsecureRelayUrl(config.relay.url)) {
		app.log.warn(
			{ event: 'relay-url-insecure', host: new URL(config.relay.url).host },
			'RELAY_URL is plain http to another host: the relay secret travels unencrypted; use https'
		);
	}

	const session = new LiveSession(config.live.logEvents);
	const serves = config.mode !== 'ingest';

	// Accounts run where viewers are; an ingest has none.
	const accountsConfig = serves ? config.accounts : null;

	await app.register(cors, {
		origin: [...config.corsOrigins],
		// Accounts write with a session cookie; without them the server is read-only.
		methods: accountsConfig
			? ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'DELETE']
			: ['GET', 'HEAD', 'OPTIONS'],
		credentials: accountsConfig !== null
	});

	if (serves) {
		await app.register(websocket, {
			options: {
				maxPayload: MAX_VIEWER_MESSAGE_BYTES,
				// Browsers state where the page came from; scripts and tools send nothing.
				verifyClient: ({ origin }, accept) =>
					accept(!origin || config.corsOrigins.includes(origin), 403, 'origin not allowed')
			}
		});
	}

	let accounts: Accounts | undefined;

	if (accountsConfig) {
		accounts = await createAccounts(accountsConfig, {
			log,
			deliverWebhook: injectWebhook(app),
			pingMs: config.ws.pingMs,
			session,
			pushSender: options.pushSender
		});
		await registerAccounts(app, accounts);
	}

	const telemetryOptions: LiveTelemetryOptions = {
		intervalMs: TELEMETRY_INTERVAL_MS,
		onError: (reason) => app.log.warn({ reason }, 'telemetry-frame-failed')
	};

	let hub: LiveHub | undefined;
	let telemetry: LiveTelemetry | undefined;

	if (serves) {
		hub = new LiveHub(session, {
			maxBufferBytes: config.ws.maxBufferBytes,
			pingMs: config.ws.pingMs,
			channelSilentMs: options.channelSilentMs,
			log: (event, fields) => app.log.info({ event, ...fields }, event)
		});
		registerLiveSocket(app, hub);
		telemetry = new LiveTelemetry(hub, telemetryOptions);
	}

	// Once shutdown starts, readiness fails so a load balancer stops sending new viewers here.
	let draining = false;

	const notReady = async (): Promise<string | null> => {
		if (draining) {
			return 'draining';
		}

		if (accounts) {
			try {
				await accounts.db.execute(sql`select 1`);
			} catch (cause) {
				app.log.warn({ err: cause }, 'accounts database unreachable');

				return 'accounts database unreachable';
			}
		}

		return null;
	};

	registerHealth(app, { mode: config.mode, session, hub, notReady });
	registerStaticData(app, config.dataDir);

	if (config.mode === 'relay' && config.relay.secret && hub) {
		registerIngest(app, session, hub, config.relay.secret);
	}

	const stop = new AbortController();

	// Nobody connects to an ingest, so its viewers are the relay's: it forwards what they opt in to.
	if (config.mode === 'ingest' && config.relay.url && config.relay.secret) {
		telemetry = new LiveTelemetry(
			new RelayChannelPusher(
				{
					url: config.relay.url,
					secret: config.relay.secret,
					log,
					fetchImpl: options.fetchImpl,
					probeMs: options.channelProbeMs
				},
				stop.signal
			),
			telemetryOptions
		);
	}

	const tasks: Promise<void>[] = [];

	const importer =
		options.importer === undefined
			? config.live.importOnFinish
				? new SessionImporter({ delayMs: config.live.importDelayMs, log })
				: null
			: options.importer;

	/** A background loop that ends on its own is a bug: say so instead of failing silently. */
	const supervise = (name: string, task: Promise<void>) =>
		task.catch((cause: unknown) => app.log.error({ err: cause }, `${name} stopped`));

	const start = () => {
		if (config.mode !== 'relay') {
			const pipeline = new LivePipeline({
				session,
				rawDir: options.rawDir ?? path.join(config.dataDir, 'raw'),
				feed: {
					url: config.live.url,
					stallMs: config.live.stallMs,
					backoff: options.feedBackoff ?? FEED_BACKOFF,
					statsIntervalMs: FEED_STATS_INTERVAL_MS,
					accessToken: config.live.accessToken
				},
				log,
				now: options.now,
				onSessionEnded: (recording) => importer?.sessionEnded(recording),
				onTelemetry: (topic, payload) => telemetry?.ingest(topic, payload)
			});

			tasks.push(supervise('live-pipeline', pipeline.run(stop.signal)));
		}

		if (config.mode === 'ingest' && config.relay.url && config.relay.secret) {
			const pusher = new RelayPusher(session, {
				url: config.relay.url,
				secret: config.relay.secret,
				backoff: options.relayBackoff ?? RELAY_BACKOFF,
				log,
				fetchImpl: options.fetchImpl
			});

			tasks.push(supervise('relay-pusher', pusher.run(stop.signal)));
		}
	};

	return {
		app,
		session,
		hub,
		listen: async () => {
			const address = await app.listen({ host: config.host, port: config.port });

			start();

			return address;
		},
		close: async () => {
			draining = true;
			stop.abort();
			telemetry?.close();
			hub?.close();
			await Promise.all(tasks);
			await importer?.close();
			await app.close();
			await accounts?.close();
		}
	};
}
