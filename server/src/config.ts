import path from 'node:path';

import { z } from 'zod';

import { LIVE_TIMING_URL } from './sources/f1/live.js';

export const MODES = ['all', 'ingest', 'relay'] as const;

export type Mode = (typeof MODES)[number];

const DEFAULT_DATA_DIR = path.resolve(import.meta.dirname, '../../data');

const MIN_SECRET_LENGTH = 16;

/** A browser origin as it appears in an `Origin` header: scheme, host and port, no path. */
const originSchema = z
	.string()
	.refine(
		(value) => URL.canParse(value) && new URL(value).origin === value,
		'must be an origin such as https://app.example.com'
	);

const originsSchema = z
	.string()
	.transform((value) =>
		value
			.split(',')
			.map((origin) => origin.trim())
			.filter((origin) => origin !== '')
	)
	.pipe(z.array(originSchema));

const envSchema = z
	.object({
		MODE: z.enum(MODES).default('all'),
		HOST: z.string().min(1).default('127.0.0.1'),
		PORT: z.coerce.number().int().min(0).max(65_535).default(3000),
		DATA_DIR: z.string().min(1).default(DEFAULT_DATA_DIR),
		CORS_ORIGINS: originsSchema.default(['http://localhost:5173', 'http://127.0.0.1:5173']),
		RELAY_URL: z.url().optional(),
		RELAY_SECRET: z.string().min(MIN_SECRET_LENGTH).optional(),
		F1TV_TOKEN: z
			.string()
			.trim()
			.regex(/^[\w.~+/=-]*$/, 'has characters a bearer token cannot have')
			.transform((token) => token || undefined)
			.optional(),
		LIVE_URL: z.url().default(LIVE_TIMING_URL),
		LIVE_STALL_SECONDS: z.coerce.number().positive().default(30),
		LOG_LEVEL: z
			.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
			.default('info'),
		IMPORT_ON_FINISH: z.stringbool().default(true),
		IMPORT_DELAY_SECONDS: z.coerce.number().min(0).default(60),
		/** Events kept for viewers that reconnect with `since`. */
		LIVE_LOG_EVENTS: z.coerce.number().int().positive().default(100_000),
		/** A viewer with more than this much unsent data is cut off. */
		WS_MAX_BUFFER_BYTES: z.coerce
			.number()
			.int()
			.positive()
			.default(4 * 1024 * 1024),
		WS_PING_SECONDS: z.coerce.number().positive().default(20)
	})
	.superRefine((env, context) => {
		const needs: Partial<Record<Mode, readonly ('RELAY_URL' | 'RELAY_SECRET')[]>> = {
			ingest: ['RELAY_URL', 'RELAY_SECRET'],
			relay: ['RELAY_SECRET']
		};

		for (const name of needs[env.MODE] ?? []) {
			if (env[name] === undefined) {
				context.addIssue({
					code: 'custom',
					path: [name],
					message: `is required when MODE=${env.MODE}`
				});
			}
		}
	});

export interface Config {
	mode: Mode;
	host: string;
	port: number;
	dataDir: string;
	corsOrigins: readonly string[];
	relay: { url?: string; secret?: string };
	live: {
		url: string;
		accessToken?: string;
		stallMs: number;
		importOnFinish: boolean;
		importDelayMs: number;
		logEvents: number;
	};
	ws: { maxBufferBytes: number; pingMs: number };
	logLevel: string;
}

/** Reads and checks the environment once, at startup; throws one error listing every problem. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
	const parsed = envSchema.safeParse(env);

	if (!parsed.success) {
		const problems = parsed.error.issues.map(
			(issue) => `${issue.path.join('.')}: ${issue.message}`
		);

		throw new Error(`Invalid environment:\n${problems.join('\n')}`);
	}

	const values = parsed.data;

	return {
		mode: values.MODE,
		host: values.HOST,
		port: values.PORT,
		dataDir: path.resolve(values.DATA_DIR),
		corsOrigins: values.CORS_ORIGINS,
		relay: { url: values.RELAY_URL, secret: values.RELAY_SECRET },
		live: {
			url: values.LIVE_URL,
			accessToken: values.F1TV_TOKEN,
			stallMs: values.LIVE_STALL_SECONDS * 1000,
			importOnFinish: values.IMPORT_ON_FINISH,
			importDelayMs: values.IMPORT_DELAY_SECONDS * 1000,
			logEvents: values.LIVE_LOG_EVENTS
		},
		ws: { maxBufferBytes: values.WS_MAX_BUFFER_BYTES, pingMs: values.WS_PING_SECONDS * 1000 },
		logLevel: values.LOG_LEVEL
	};
}
