import type { FastifyInstance } from 'fastify';

import {
	FAKE_SIGNATURE_HEADER,
	FakeProvider,
	type WebhookDelivery
} from '../payments/fake-provider.js';
import type { PaymentProvider } from '../payments/provider.js';
import { StripeProvider } from '../payments/stripe-provider.js';
import type { EventLog } from '../sources/f1/live.js';
import { type Auth, createAuth } from './auth.js';
import type { AccountsConfig } from './config.js';
import { type AccountsDatabase, openDatabase } from './db/database.js';
import { ConsoleMailer, type Mailer, SmtpMailer } from './mailer.js';

export const WEBHOOK_PATH = '/api/billing/webhook';

/** Everything the accounts routes need, built once at startup. */
export interface Accounts {
	config: AccountsConfig;
	db: AccountsDatabase;
	auth: Auth;
	mailer: Mailer;
	/** The development mailbox, when sign-in links are printed rather than sent. */
	devMailbox: ConsoleMailer | null;
	payments: PaymentProvider;
	/** The fake provider's own pages are served only when it is the provider. */
	fakePayments: FakeProvider | null;
	log: EventLog;
	now: () => Date;
	close: () => Promise<void>;
}

export interface AccountsOptions {
	log: EventLog;
	/** How the fake provider's signed events reach the webhook route. */
	deliverWebhook: WebhookDelivery;
	now?: () => Date;
}

export async function createAccounts(
	config: AccountsConfig,
	options: AccountsOptions
): Promise<Accounts> {
	const { db, close } = await openDatabase(config.database);
	const now = options.now ?? (() => new Date());
	const { mailer, devMailbox } = createMail(config, options.log);

	const { payments, fakePayments } = createPayments(config, options.deliverWebhook, now);

	return {
		config,
		db,
		auth: createAuth(config, db, mailer),
		mailer,
		devMailbox,
		payments,
		fakePayments,
		log: options.log,
		now,
		close
	};
}

interface Mail {
	mailer: Mailer;
	devMailbox: ConsoleMailer | null;
}

interface Payments {
	payments: PaymentProvider;
	fakePayments: FakeProvider | null;
}

function createMail(config: AccountsConfig, log: EventLog): Mail {
	if (config.mail.smtpUrl) {
		return { mailer: new SmtpMailer(config.mail.smtpUrl, config.mail.from), devMailbox: null };
	}

	const devMailbox = new ConsoleMailer(log);

	return { mailer: devMailbox, devMailbox };
}

function createPayments(
	config: AccountsConfig,
	deliver: WebhookDelivery,
	now: () => Date
): Payments {
	if (config.payments.kind === 'stripe') {
		return { payments: new StripeProvider(config.payments), fakePayments: null };
	}

	const fake = new FakeProvider({
		publicUrl: config.publicUrl,
		webhookSecret: config.payments.webhookSecret,
		statePath: config.payments.statePath,
		deliver,
		now
	});

	return { payments: fake, fakePayments: fake };
}

/**
 * Delivers a fake event through the server's own HTTP pipeline, signature check and all, as
 * Stripe's POST would arrive; going through the app rather than a socket works on any host and
 * port.
 */
export function injectWebhook(app: FastifyInstance): WebhookDelivery {
	return async (payload, signature) => {
		const response = await app.inject({
			method: 'POST',
			url: WEBHOOK_PATH,
			headers: { 'content-type': 'application/json', [FAKE_SIGNATURE_HEADER]: signature },
			payload
		});

		if (response.statusCode >= 300) {
			throw new Error(`Webhook delivery failed with ${response.statusCode}: ${response.body}`);
		}
	};
}
