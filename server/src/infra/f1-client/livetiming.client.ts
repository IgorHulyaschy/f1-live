import { WebSocket } from 'ws';

import type { LiveHandlerFactory } from '../../app/use-cases/live/live.handler.js';
import type { Logger } from '../logger/index.js';

import { FRAME_DELIMITER, parseFeedFrame } from './feed-frame.js';
import { Topic } from './types/constants.js';
import type { SnapshotHandlers } from './types/sync-events.types.js';

const wsMessageDelimiter = FRAME_DELIMITER;

type NegotiateResponse = { connectionToken?: string; connectionId: string };

export type LiveTimingEndpoints = {
	negotiateUrl: string;
	connectionUrl: string;
};

export class LiveTimingClient {
	private connection: WebSocket | null = null;
	private cookie: string | null = null;
	private connectionParam = '';
	private readonly logger: Logger;
	private readonly negotiateUrl: string;
	private readonly wsUrl: string;

	constructor(logger: Logger, endpoints: LiveTimingEndpoints) {
		this.logger = logger;
		this.negotiateUrl = endpoints.negotiateUrl;
		this.wsUrl = endpoints.connectionUrl;
	}

	async init() {
		await this.negotiateConnection();

		const connection = new WebSocket(
			`${this.wsUrl}?id=${encodeURIComponent(this.connectionParam)}`,
			{
				headers: {
					Cookie: `AWSALBCORS=${this.cookie ?? ''}`,
					Origin: 'https://www.formula1.com',
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
				}
			}
		);

		this.connection = connection;

		connection.on('open', () => {
			this.logger.info('Websocket connected');

			connection.send(
				`${JSON.stringify({
					protocol: 'json',
					version: 1
				})}${wsMessageDelimiter}`
			);
		});

		connection.on('error', (error) => {
			this.logger.error(error);
		});

		connection.on('close', (code, reason) => {
			this.logger.info(`Websocket closed: ${code} ${reason}`);
		});
	}

	stop() {
		this.connection?.close();
	}

	onMessage(snapshotHandlers: SnapshotHandlers, liveHandlerFactory: LiveHandlerFactory) {
		this.requireConnection().on('message', (data) => {
			const frames = data.toString().split(FRAME_DELIMITER).filter(Boolean);

			for (const text of frames) {
				const frame = parseFeedFrame(text);

				switch (frame.kind) {
					case 'handshake':
						this.logger.info('Handshake completed!');
						this.subscribesToTopics();
						break;
					case 'ping':
						this.requireConnection().send(`${JSON.stringify({ type: 6 })}${wsMessageDelimiter}`);
						break;
					case 'snapshot':
						if (frame.snapshot.sessionInfo) {
							void snapshotHandlers[Topic.SESSION_INFO](frame.snapshot.sessionInfo);
						}

						if (frame.snapshot.driverList) {
							void snapshotHandlers[Topic.DRIVER_LIST](frame.snapshot.driverList);
						}

						break;
					case 'live':
						this.logger.info(`[LIVE UPDATE] ${frame.event[0]}`);
						void liveHandlerFactory.handleLiveUpdates(frame.event);
						break;
					case 'ignored':
						break;
				}
			}
		});
	}

	private requireConnection(): WebSocket {
		if (!this.connection) {
			throw new Error('LiveTimingClient.init() must run before using the connection');
		}

		return this.connection;
	}

	private subscribesToTopics() {
		this.requireConnection().send(
			JSON.stringify({
				arguments: [
					[
						Topic.SESSION_INFO,
						Topic.DRIVER_LIST,
						Topic.TIMING_DATA,
						'Heartbeat',
						'AudioStreams',
						'ExtrapolatedClock',
						'RaceControlMessages',
						'SessionStatus',
						'TeamRadio',
						'TimingStats',
						'TrackStatus',
						'WeatherData',
						'Position.z',
						'CarData.z',
						'ContentStreams',
						'SessionData',
						'TimingData',
						'TopThree',
						'RcmSeries',
						'LapCount'
					]
				],
				invocationId: '1',
				target: 'Subscribe',
				type: 1
			}) + wsMessageDelimiter
		);
	}

	async negotiateConnection() {
		const optionsResponse = await fetch(this.negotiateUrl, {
			method: 'OPTIONS',
			headers: {
				Accept: '*/*',
				'Accept-Language': 'en-US,en;q=0.9',
				'Access-Control-Request-Method': 'POST',
				'Access-Control-Request-Headers': 'content-type,x-requested-with',
				Origin: 'https://www.formula1.com',
				Referer: 'https://www.formula1.com/'
			},
			credentials: 'include'
		});

		const setCookie = optionsResponse.headers.get('set-cookie');
		let awsalbcors: string | null = null;

		if (setCookie) {
			const match = /AWSALBCORS=([^;]+)/.exec(setCookie);

			if (match) {
				awsalbcors = match[1] ?? null;
			}
		}

		// Step 2: POST request to negotiate endpoint to get connection info
		const negotiateResponse = await fetch(this.negotiateUrl + '?negotiateVersion=1', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Requested-With': 'XMLHttpRequest',
				Origin: 'https://www.formula1.com',
				Referer: 'https://www.formula1.com/',
				...(awsalbcors && { Cookie: `AWSALBCORS=${awsalbcors}` })
			},
			credentials: 'include',
			body: JSON.stringify({})
		});

		if (!negotiateResponse.ok) {
			throw new Error(`Negotiate failed with status ${negotiateResponse.status.toString()}`);
		}

		// SAFETY: a successful negotiate response is the SignalR negotiate payload.
		const negotiateData = (await negotiateResponse.json()) as NegotiateResponse;

		this.cookie = awsalbcors;
		this.connectionParam = negotiateData.connectionToken || negotiateData.connectionId;
	}
}
