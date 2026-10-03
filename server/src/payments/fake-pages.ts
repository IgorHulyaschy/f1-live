import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { FakeAction, FakeProvider } from './fake-provider.js';

const idParams = z.object({ id: z.string() });

const portalParams = z.object({
	id: z.string(),
	subscription: z.string(),
	action: z.enum(['cancel-at-period-end', 'resume', 'cancel-now'])
});

const ACTION_LABEL: Record<FakeAction, string> = {
	'cancel-at-period-end': 'Cancel at period end',
	resume: 'Keep my subscription',
	'cancel-now': 'Cancel now'
};

/**
 * The fake provider's hosted pages: a checkout with Pay and Cancel, and a billing page to cancel
 * or resume. Plain HTML forms, like a provider's own pages, styled after the app's timing screen.
 */
export function registerFakePages(
	app: FastifyInstance,
	provider: FakeProvider,
	brand: string
): void {
	// The forms post no fields; the ids are in the path.
	app.addContentTypeParser(
		'application/x-www-form-urlencoded',
		{ parseAs: 'string' },
		(_request, body, done) => done(null, body)
	);

	app.get('/api/billing/fake/checkout/:id', async (request, reply) => {
		const { id } = idParams.parse(request.params);
		const session = provider.checkout(id);

		if (!session || session.status !== 'open') {
			return reply
				.status(404)
				.type('text/html')
				.send(
					page(
						brand,
						'Checkout closed',
						'<p>This checkout has finished. Start again from the app.</p>'
					)
				);
		}

		const { email, interval } = session.request;

		return reply.type('text/html').send(
			page(
				brand,
				'Checkout',
				`<dl>
					<div><dt>Plan</dt><dd>${escapeHtml(brand)} Pro</dd></div>
					<div><dt>Billed</dt><dd>${interval === 'year' ? 'Yearly' : 'Monthly'}</dd></div>
					<div><dt>Account</dt><dd>${escapeHtml(email)}</dd></div>
				</dl>
				<p class="note">Test mode: the fake payment provider takes no card and moves no money.
				Pay sends a signed webhook to the accounts server, as a real provider would.</p>
				<div class="keys">
					<form method="post" action="/api/billing/fake/checkout/${encodeURIComponent(id)}/cancel">
						<button type="submit">Cancel</button>
					</form>
					<form method="post" action="/api/billing/fake/checkout/${encodeURIComponent(id)}/pay">
						<button type="submit" class="pressed">Pay</button>
					</form>
				</div>`
			)
		);
	});

	app.post('/api/billing/fake/checkout/:id/pay', async (request, reply) => {
		const { id } = idParams.parse(request.params);

		return reply.redirect(await provider.pay(id), 303);
	});

	app.post('/api/billing/fake/checkout/:id/cancel', async (request, reply) => {
		const { id } = idParams.parse(request.params);

		return reply.redirect(provider.abandon(id), 303);
	});

	app.get('/api/billing/fake/portal/:id', async (request, reply) => {
		const { id } = idParams.parse(request.params);
		const portal = provider.portal(id);

		if (!portal) {
			return reply
				.status(404)
				.type('text/html')
				.send(
					page(
						brand,
						'Billing',
						'<p>This billing link has expired. Open it again from the app.</p>'
					)
				);
		}

		const rows = portal.subscriptions.map((subscription) => {
			const state =
				subscription.status === 'canceled'
					? 'Cancelled'
					: subscription.cancelAtPeriodEnd
						? `Ends ${formatDate(subscription.currentPeriodEnd)}`
						: `Renews ${formatDate(subscription.currentPeriodEnd)}`;

			const actions: FakeAction[] =
				subscription.status === 'canceled'
					? []
					: subscription.cancelAtPeriodEnd
						? ['resume', 'cancel-now']
						: ['cancel-at-period-end', 'cancel-now'];

			return `<section>
				<dl>
					<div><dt>Plan</dt><dd>${escapeHtml(brand)} Pro, ${subscription.interval === 'year' ? 'yearly' : 'monthly'}</dd></div>
					<div><dt>Status</dt><dd>${state}</dd></div>
				</dl>
				<div class="keys">${actions
					.map(
						(action) =>
							`<form method="post" action="/api/billing/fake/portal/${encodeURIComponent(id)}/${encodeURIComponent(subscription.id)}/${action}">
								<button type="submit">${ACTION_LABEL[action]}</button>
							</form>`
					)
					.join('')}</div>
			</section>`;
		});

		return reply.type('text/html').send(
			page(
				brand,
				'Billing',
				`${rows.join('') || '<p>No subscriptions on this billing account.</p>'}
				<p class="note">Test mode: changes here send signed webhooks to the accounts server.</p>
				<div class="keys"><a class="pressed" href="${escapeHtml(portal.session.returnUrl)}">Back to ${escapeHtml(brand)}</a></div>`
			)
		);
	});

	app.post('/api/billing/fake/portal/:id/:subscription/:action', async (request, reply) => {
		const { id, subscription, action } = portalParams.parse(request.params);
		const portal = provider.portal(id);

		if (!portal?.subscriptions.some((entry) => entry.id === subscription)) {
			return reply.status(404).send({ error: 'not_found', message: 'No such subscription' });
		}

		await provider.change(subscription, action);

		return reply.redirect(`/api/billing/fake/portal/${encodeURIComponent(id)}`, 303);
	});
}

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

export function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function page(brand: string, title: string, body: string): string {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}: ${escapeHtml(brand)} test payments</title>
<style>
	:root { color-scheme: light dark; --bg: oklch(0.975 0.005 95); --fg: oklch(0.2 0.008 95); --muted: oklch(0.45 0.01 95); --rule: oklch(0.2 0.008 95 / 12%); --strong: oklch(0.2 0.008 95 / 70%); }
	@media (prefers-color-scheme: dark) { :root { --bg: oklch(0.155 0.004 95); --fg: oklch(0.93 0.01 95); --muted: oklch(0.72 0.01 95); --rule: oklch(0.93 0.01 95 / 9%); --strong: oklch(0.93 0.01 95 / 55%); } }
	* { box-sizing: border-box; border-radius: 0; }
	body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.5 ui-sans-serif, system-ui, sans-serif; }
	main { max-width: 32rem; margin: 0 auto; padding: 3rem 1rem; display: grid; gap: 1.25rem; }
	header { border-bottom: 2px solid var(--strong); padding-bottom: 0.4rem; display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; }
	h1 { margin: 0; font-size: 1.5rem; font-weight: 900; font-style: italic; letter-spacing: 0.02em; text-transform: uppercase; }
	.label, dt, button, a.pressed { font: 600 11px/1 ui-monospace, 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace; letter-spacing: 0.08em; text-transform: uppercase; }
	.label, dt { color: var(--muted); }
	dl { margin: 0; display: grid; }
	dl div { display: flex; gap: 1rem; border-bottom: 1px solid var(--rule); padding: 0.5rem 0; }
	dt { width: 6rem; flex-shrink: 0; padding-top: 0.2rem; }
	dd { margin: 0; overflow-wrap: anywhere; }
	section { display: grid; gap: 0.75rem; }
	.note { color: var(--muted); font-size: 13px; margin: 0; }
	.keys { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-end; }
	form { margin: 0; }
	button, a.pressed { cursor: pointer; display: inline-flex; align-items: center; height: 2.25rem; padding: 0 0.75rem; border: 1px solid var(--rule); border-bottom-width: 2px; background: transparent; color: var(--fg); text-decoration: none; }
	button:hover { border-color: var(--strong); }
	button.pressed, a.pressed { background: var(--fg); color: var(--bg); border-color: var(--fg); }
	button:focus-visible, a:focus-visible { outline: 2px solid var(--strong); outline-offset: 2px; }
</style>
</head>
<body>
<main>
	<header><h1>${escapeHtml(title)}</h1><span class="label">Test payments</span></header>
	${body}
</main>
</body>
</html>`;
}
