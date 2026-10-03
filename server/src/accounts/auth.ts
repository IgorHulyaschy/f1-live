import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins/magic-link';

import type { AccountsConfig } from './config.js';
import type { AccountsDatabase } from './db/database.js';
import { account, session, user, verification } from './db/schema.js';
import { type Mailer, signInMessage } from './mailer.js';

/** Sessions last 30 days and slide forward once a day while the app is in use. */
const SESSION_SECONDS = 30 * 24 * 60 * 60;

/** How long a sign-in link works; the email says 5 minutes. */
const MAGIC_LINK_SECONDS = 5 * 60;

/**
 * Better Auth on our own server and database: email magic links, and Google and Apple only when
 * their keys are set. No passwords. Sessions are httpOnly, SameSite=Lax cookies; state-changing
 * requests from an untrusted origin are refused.
 */
export function createAuth(config: AccountsConfig, db: AccountsDatabase, mailer: Mailer) {
	const { google, apple } = config.social;

	return betterAuth({
		appName: config.brand,
		baseURL: config.publicUrl,
		basePath: '/api/auth',
		secret: config.secret,
		// Apple posts its sign-in result back from its own origin.
		trustedOrigins: apple
			? [...config.trustedOrigins, 'https://appleid.apple.com']
			: [...config.trustedOrigins],
		database: drizzleAdapter(db, {
			provider: 'pg',
			schema: { user, session, account, verification }
		}),
		session: { expiresIn: SESSION_SECONDS },
		advanced: config.cookieDomain
			? { crossSubDomainCookies: { enabled: true, domain: config.cookieDomain } }
			: undefined,
		// An unset provider is left out entirely: no button, no route.
		socialProviders: { google: google ?? undefined, apple: apple ?? undefined },
		plugins: [
			magicLink({
				expiresIn: MAGIC_LINK_SECONDS,
				sendMagicLink: async ({ email, url }) => {
					await mailer.send(signInMessage(config.brand, email, url));
				}
			})
		],
		// Better Auth would key this on NODE_ENV alone; production rules here also cover public URLs.
		rateLimit: { enabled: config.production },
		telemetry: { enabled: false }
	});
}

export type Auth = ReturnType<typeof createAuth>;
