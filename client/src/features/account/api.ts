import { dashboardSchema } from '@f1-live/shared/dashboard';
import { PLAN_IDS } from '@f1-live/shared/plans';
import { z } from 'zod';

import type { PushOp, PushOutcome, RemoteDoc } from './sync-rules';

/**
 * The accounts API (server/src/accounts/routes.ts). Same origin by default: Vite proxies `/api`
 * in development, and a deployment serves it under the app's origin or a same-site one.
 */
const BASE = import.meta.env.VITE_ACCOUNTS_URL ?? '';

const BILLING_INTERVALS = ['month', 'year'] as const;

export type BillingInterval = (typeof BILLING_INTERVALS)[number];

const entitlementsSchema = z.object({
	ownDashboards: z.int().nullable(),
	shareLinks: z.boolean(),
	proTiles: z.boolean(),
	publish: z.boolean()
});

export const meSchema = z.object({
	user: z.object({
		id: z.string(),
		email: z.string(),
		name: z.string(),
		createdAt: z.iso.datetime()
	}),
	plan: z.enum(PLAN_IDS),
	entitlements: entitlementsSchema,
	subscription: z
		.object({
			status: z.string(),
			interval: z.enum(BILLING_INTERVALS).nullable(),
			currentPeriodEnd: z.iso.datetime().nullable(),
			cancelAtPeriodEnd: z.boolean()
		})
		.nullable(),
	billing: z.object({ portal: z.boolean() })
});

export type Me = z.infer<typeof meSchema>;

const configSchema = z.object({
	brand: z.string(),
	providers: z.object({ google: z.boolean(), apple: z.boolean() }),
	devMailbox: z.boolean(),
	payments: z.object({
		provider: z.string(),
		prices: z.array(
			z.object({
				interval: z.enum(BILLING_INTERVALS),
				amount: z.int().nullable(),
				currency: z.string().nullable()
			})
		)
	})
});

export type AccountsConfig = z.infer<typeof configSchema>;

const remoteDocSchema = z.object({
	id: z.string(),
	version: z.int().min(0),
	updatedAt: z.iso.datetime(),
	dashboard: dashboardSchema.nullable()
});

const documentReply = z.object({ document: remoteDocSchema });

const errorReply = z.object({ error: z.string(), message: z.string() });

const limitReply = z.object({ error: z.literal('dashboard_limit'), limit: z.int() });

const urlReply = z.object({ url: z.url() });

/**
 * Why a call failed. `unavailable`: no accounts server answered (none runs here, or it is down).
 * `signed-out`: the session ended. `refused`: the server said no, with a reason to show.
 */
export class AccountsError extends Error {
	override readonly name = 'AccountsError';
	readonly kind: 'unavailable' | 'signed-out' | 'refused';
	readonly code: string;

	constructor(kind: AccountsError['kind'], code: string, message: string) {
		super(message);
		this.kind = kind;
		this.code = code;
	}
}

/** `body` is the request, already serialised. */
async function send(method: string, path: string, body?: string): Promise<Response> {
	let response: Response;

	try {
		response = await fetch(`${BASE}${path}`, {
			method,
			credentials: 'include',
			headers: body ? { 'content-type': 'application/json' } : undefined,
			body
		});
	} catch {
		throw new AccountsError('unavailable', 'network', 'The accounts server is not reachable');
	}

	if (response.status === 401) {
		throw new AccountsError('signed-out', 'unauthorized', 'Sign in first');
	}

	if (response.status >= 500) {
		const reason = errorReply.safeParse(await response.json().catch(() => null));

		throw new AccountsError(
			'unavailable',
			reason.data?.error ?? 'server',
			reason.data?.message ?? 'The accounts server did not answer'
		);
	}

	return response;
}

async function json<Value>(response: Response, schema: z.ZodType<Value>): Promise<Value> {
	const body = await response.json().catch(() => null);

	if (!response.ok) {
		const reason = errorReply.safeParse(body);

		throw new AccountsError(
			'refused',
			reason.data?.error ?? String(response.status),
			reason.data?.message ?? 'The accounts server refused this'
		);
	}

	return schema.parse(body);
}

/** The signed-in account, or null when nobody is signed in. */
export async function fetchMe(): Promise<Me | null> {
	return json(await send('GET', '/api/me'), meSchema.nullable());
}

export async function fetchConfig(): Promise<AccountsConfig> {
	return json(await send('GET', '/api/config'), configSchema);
}

/** Asks for a sign-in link; opening it signs in and returns to `callbackUrl`. */
export async function sendSignInLink(email: string, callbackUrl: string): Promise<void> {
	await json(
		await send(
			'POST',
			'/api/auth/sign-in/magic-link',
			JSON.stringify({
				email,
				callbackURL: callbackUrl,
				errorCallbackURL: `${window.location.origin}/account`
			})
		),
		z.object({ status: z.boolean() })
	);
}

/** Starts Google or Apple sign-in; resolves to the provider's page to open. */
export async function socialSignInUrl(
	provider: 'google' | 'apple',
	callbackUrl: string
): Promise<string> {
	const reply = await json(
		await send(
			'POST',
			'/api/auth/sign-in/social',
			JSON.stringify({
				provider,
				callbackURL: callbackUrl,
				errorCallbackURL: `${window.location.origin}/account`
			})
		),
		urlReply
	);

	return reply.url;
}

export async function signOutSession(): Promise<void> {
	await json(
		await send('POST', '/api/auth/sign-out', JSON.stringify({})),
		z.object({ success: z.boolean() })
	);
}

export async function listDocuments(): Promise<RemoteDoc[]> {
	const reply = await json(
		await send('GET', '/api/me/dashboards'),
		z.object({ documents: z.array(remoteDocSchema) })
	);

	return reply.documents;
}

/** Sends one save or deletion; a conflict or the Free limit is an answer, not a failure. */
export async function pushDocument(op: PushOp): Promise<PushOutcome> {
	const response =
		op.kind === 'put'
			? await send(
					'PUT',
					`/api/me/dashboards/${encodeURIComponent(op.dashboard.id)}`,
					JSON.stringify({
						dashboard: op.dashboard,
						baseVersion: op.baseVersion,
						updatedAt: op.updatedAt
					})
				)
			: await send(
					'DELETE',
					`/api/me/dashboards/${encodeURIComponent(op.id)}`,
					JSON.stringify({
						baseVersion: op.baseVersion,
						updatedAt: op.updatedAt
					})
				);

	if (response.status === 409) {
		return { kind: 'stale', document: documentReply.parse(await response.json()).document };
	}

	if (response.status === 403) {
		const limit = limitReply.safeParse(await response.clone().json());

		if (limit.success) {
			return { kind: 'limit', limit: limit.data.limit };
		}
	}

	return { kind: 'saved', document: (await json(response, documentReply)).document };
}

/** The provider's checkout page for Pro. */
export async function checkoutUrl(interval: BillingInterval): Promise<string> {
	return (
		await json(await send('POST', '/api/billing/checkout', JSON.stringify({ interval })), urlReply)
	).url;
}

/** The provider's page to change or cancel Pro. */
export async function billingPortalUrl(): Promise<string> {
	return (await json(await send('POST', '/api/billing/portal', JSON.stringify({})), urlReply)).url;
}

export async function downloadAccountData(): Promise<Blob> {
	const response = await send('GET', '/api/me/export');

	if (!response.ok) {
		throw new AccountsError('refused', String(response.status), 'The export failed');
	}

	return response.blob();
}

export async function deleteAccount(confirm: string): Promise<void> {
	await json(
		await send('DELETE', '/api/me', JSON.stringify({ confirm })),
		z.object({ deleted: z.boolean() })
	);
}
