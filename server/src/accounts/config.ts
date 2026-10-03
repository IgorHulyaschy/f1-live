import path from 'node:path';

import { z } from 'zod';

import type { BillingInterval } from '../payments/provider.js';

/**
 * Accounts settings, all from the environment and documented in server/.env.example. Accounts
 * are off unless a database is chosen. `ACCOUNTS_DB=pglite` needs nothing else: PGlite on disk,
 * sign-in links printed to the log and the fake payment provider. Production refuses to start
 * without real values.
 */
export interface AccountsConfig {
	/** Production rules: real secret, Postgres, SMTP, Stripe, https. */
	production: boolean;
	/** The product name in emails and payment pages; the owner's to choose. */
	brand: string;
	/** The app's origin: where sign-in and checkout send people back to. */
	appUrl: string;
	/** Where browsers reach `/api`: the app's origin when it proxies `/api` to this server. */
	publicUrl: string;
	trustedOrigins: readonly string[];
	/** Shares the session cookie with every subdomain, for an app and an API on sibling hosts. */
	cookieDomain: string | null;
	secret: string;
	database: { kind: 'postgres'; url: string } | { kind: 'pglite'; dataDir: string | null };
	mail: {
		from: string;
		smtpUrl: string | null;
		/**
		 * Serves the development mailbox to any address, not only loopback. For a stack whose ports
		 * are published on 127.0.0.1 only (docker compose), where requests arrive from the bridge.
		 */
		devMailboxAnyIp: boolean;
	};
	social: {
		google: { clientId: string; clientSecret: string } | null;
		apple: { clientId: string; clientSecret: string; appBundleIdentifier?: string } | null;
	};
	payments:
		| { kind: 'fake'; webhookSecret: string; statePath: string | null }
		| {
				kind: 'stripe';
				secretKey: string;
				webhookSecret: string;
				priceIds: Record<BillingInterval, string>;
		  };
}

/** What the accounts settings take from the server's own. */
export interface ServerSettings {
	dataDir: string;
	corsOrigins: readonly string[];
}

// Development-only values: production refuses to start with them.
const DEVELOPMENT_SECRET = 'pitwall-development-only-secret-never-use-in-production';

const DEVELOPMENT_FAKE_WEBHOOK_SECRET = 'fake-provider-development-webhook-secret';

const MIN_SECRET_LENGTH = 32;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** An env var that may be absent or blank; blank counts as absent. */
const optional = z
	.string()
	.optional()
	.transform((value) => value?.trim() || undefined);

const httpUrl = z.url({ protocol: /^https?$/ });

const envSchema = z.object({
	NODE_ENV: optional,
	ACCOUNTS_DB: optional.pipe(z.enum(['postgres', 'pglite', 'memory']).optional()),
	DATABASE_URL: optional,
	BRAND_NAME: optional,
	APP_URL: optional.pipe(httpUrl.default('http://localhost:5173')),
	ACCOUNTS_PUBLIC_URL: optional.pipe(httpUrl.optional()),
	COOKIE_DOMAIN: optional.pipe(
		z
			.string()
			.regex(/^[\w.-]+$/, 'must be a bare domain such as example.com')
			.optional()
	),
	BETTER_AUTH_SECRET: optional,
	MAIL_FROM: optional,
	SMTP_URL: optional,
	DEV_MAILBOX_ANY_IP: optional.pipe(z.stringbool().optional()),
	GOOGLE_CLIENT_ID: optional,
	GOOGLE_CLIENT_SECRET: optional,
	APPLE_CLIENT_ID: optional,
	APPLE_CLIENT_SECRET: optional,
	APPLE_APP_BUNDLE_IDENTIFIER: optional,
	PAYMENTS_PROVIDER: optional.pipe(z.enum(['fake', 'stripe']).optional()),
	FAKE_WEBHOOK_SECRET: optional,
	STRIPE_SECRET_KEY: optional,
	STRIPE_WEBHOOK_SECRET: optional,
	STRIPE_PRICE_PRO_MONTHLY: optional,
	STRIPE_PRICE_PRO_YEARLY: optional
});

/** Reads the accounts settings; null when no database is chosen and accounts stay off. */
export function loadAccountsConfig(
	env: NodeJS.ProcessEnv,
	server: ServerSettings
): AccountsConfig | null {
	const parsed = envSchema.safeParse(env);

	if (!parsed.success) {
		throw new Error(
			`Invalid environment:\n${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n')}`
		);
	}

	const values = parsed.data;
	const db = values.ACCOUNTS_DB ?? (values.DATABASE_URL ? 'postgres' : null);

	if (!db) {
		return null;
	}

	const problems: string[] = [];
	const appUrl = new URL(values.APP_URL).origin;
	const publicUrl = (values.ACCOUNTS_PUBLIC_URL ?? appUrl).replace(/\/+$/, '');
	// Development stand-ins (a known secret, printed sign-in links, free Pro) only ever serve this
	// machine: an app reachable from anywhere else gets production rules, NODE_ENV or not.

	const production =
		values.NODE_ENV === 'production' ||
		![appUrl, publicUrl].every((url) => LOOPBACK_HOSTS.has(new URL(url).hostname));

	const brand = values.BRAND_NAME ?? 'Pitwall';
	const accountsDir = db === 'pglite' ? path.join(server.dataDir, 'accounts') : null;

	const need = (name: string, value: string | undefined): string => {
		if (!value) {
			problems.push(`${name}: is required`);
		}

		return value ?? '';
	};

	const paymentsKind = values.PAYMENTS_PROVIDER ?? (production ? 'stripe' : 'fake');

	if (db === 'postgres') {
		need('DATABASE_URL', values.DATABASE_URL);
	}

	if (production) {
		if ((values.BETTER_AUTH_SECRET ?? '').length < MIN_SECRET_LENGTH) {
			problems.push(`BETTER_AUTH_SECRET: needs ${MIN_SECRET_LENGTH}+ characters in production`);
		}

		if (db !== 'postgres') {
			problems.push('ACCOUNTS_DB: production keeps accounts in Postgres (DATABASE_URL)');
		}

		if (!values.SMTP_URL) {
			problems.push('SMTP_URL: is required in production, or sign-in links reach nobody');
		}

		if (paymentsKind === 'fake') {
			problems.push('PAYMENTS_PROVIDER: fake would give Pro away in production');
		}

		if (!publicUrl.startsWith('https://')) {
			problems.push('ACCOUNTS_PUBLIC_URL: must be https in production');
		}
	}

	// A provider is on when either of its values is set, so a half-done setup fails loudly.
	const google =
		values.GOOGLE_CLIENT_ID || values.GOOGLE_CLIENT_SECRET
			? {
					clientId: need('GOOGLE_CLIENT_ID', values.GOOGLE_CLIENT_ID),
					clientSecret: need('GOOGLE_CLIENT_SECRET', values.GOOGLE_CLIENT_SECRET)
				}
			: null;

	const apple =
		values.APPLE_CLIENT_ID || values.APPLE_CLIENT_SECRET
			? {
					clientId: need('APPLE_CLIENT_ID', values.APPLE_CLIENT_ID),
					clientSecret: need('APPLE_CLIENT_SECRET', values.APPLE_CLIENT_SECRET),
					appBundleIdentifier: values.APPLE_APP_BUNDLE_IDENTIFIER
				}
			: null;

	const payments: AccountsConfig['payments'] =
		paymentsKind === 'stripe'
			? {
					kind: 'stripe',
					secretKey: need('STRIPE_SECRET_KEY', values.STRIPE_SECRET_KEY),
					webhookSecret: need('STRIPE_WEBHOOK_SECRET', values.STRIPE_WEBHOOK_SECRET),
					priceIds: {
						month: need('STRIPE_PRICE_PRO_MONTHLY', values.STRIPE_PRICE_PRO_MONTHLY),
						year: need('STRIPE_PRICE_PRO_YEARLY', values.STRIPE_PRICE_PRO_YEARLY)
					}
				}
			: {
					kind: 'fake',
					webhookSecret: values.FAKE_WEBHOOK_SECRET ?? DEVELOPMENT_FAKE_WEBHOOK_SECRET,
					statePath: accountsDir ? path.join(accountsDir, 'fake-billing.json') : null
				};

	if (problems.length > 0) {
		throw new Error(`Invalid environment:\n${problems.join('\n')}`);
	}

	return {
		production,
		brand,
		appUrl,
		publicUrl,
		trustedOrigins: [...new Set([appUrl, new URL(publicUrl).origin, ...server.corsOrigins])],
		cookieDomain: values.COOKIE_DOMAIN ?? null,
		secret: values.BETTER_AUTH_SECRET ?? DEVELOPMENT_SECRET,
		database:
			db === 'postgres'
				? { kind: 'postgres', url: values.DATABASE_URL ?? '' }
				: { kind: 'pglite', dataDir: accountsDir ? path.join(accountsDir, 'pglite') : null },
		mail: {
			from: values.MAIL_FROM ?? `${brand} <sign-in@localhost>`,
			smtpUrl: values.SMTP_URL ?? null,
			devMailboxAnyIp: values.DEV_MAILBOX_ANY_IP ?? false
		},
		social: { google, apple },
		payments
	};
}
