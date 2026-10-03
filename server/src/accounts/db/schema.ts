import type { Dashboard } from '@f1-live/shared/dashboard';
import type { ViewerSettings } from '@f1-live/shared/viewer';
import {
	boolean,
	index,
	integer,
	jsonb,
	pgSchema,
	primaryKey,
	text,
	timestamp
} from 'drizzle-orm/pg-core';

import type { BillingInterval, SubscriptionStatus } from '../../payments/provider.js';

/**
 * Accounts live in their own Postgres schema with their own migrations, so they can share a
 * database with anything else without touching it.
 */
export const accountsSchema = pgSchema('accounts');

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();

const updatedAt = () =>
	timestamp('updated_at', { withTimezone: true })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull();

// The four tables below are Better Auth's; their property names are the ones it expects.

export const user = accountsSchema.table('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').default(false).notNull(),
	image: text('image'),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

export const session = accountsSchema.table(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		token: text('token').notNull().unique(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
	},
	(table) => [index('session_user_id_idx').on(table.userId)]
);

export const account = accountsSchema.table(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
		scope: text('scope'),
		password: text('password'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [index('account_user_id_idx').on(table.userId)]
);

export const verification = accountsSchema.table(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [index('verification_identifier_idx').on(table.identifier)]
);

/**
 * One row per saved dashboard. `version` goes up on every accepted write; a deletion keeps the
 * row with no document, so other devices learn about it.
 */
export const dashboard = accountsSchema.table(
	'dashboard',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		id: text('id').notNull(),
		document: jsonb('document').$type<Dashboard>(),
		version: integer('version').notNull(),
		/** When the winning edit was made, on the device that made it (never in the future). */
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull()
	},
	(table) => [primaryKey({ columns: [table.userId, table.id] })]
);

/** The viewer's spoiler settings, one row per account, merged on every write. */
export const viewerSettings = accountsSchema.table('viewer_settings', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	settings: jsonb('settings').$type<ViewerSettings>().notNull(),
	updatedAt: updatedAt()
});

/**
 * Accounts deleted here, by id only: a payment that lands for one of them afterwards is
 * cancelled, while events naming an id this server never had are left alone.
 */
export const deletedAccount = accountsSchema.table('deleted_account', {
	userId: text('user_id').primaryKey(),
	deletedAt: timestamp('deleted_at', { withTimezone: true }).defaultNow().notNull()
});

/** The payment provider's view of a subscription, refreshed from every webhook. */
export const subscription = accountsSchema.table(
	'subscription',
	{
		provider: text('provider').notNull(),
		id: text('id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		customerId: text('customer_id').notNull(),
		status: text('status').$type<SubscriptionStatus>().notNull(),
		interval: text('interval').$type<BillingInterval>(),
		currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
		cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		primaryKey({ columns: [table.provider, table.id] }),
		index('subscription_user_id_idx').on(table.userId)
	]
);
