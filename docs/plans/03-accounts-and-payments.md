# Plan 3: Accounts and payments

## Goal

Replace the in-browser mocks with real accounts:

- dashboards synced across devices;
- a real fan library;
- Pro paid through Stripe.

The mocks already define the behaviour and the payloads (see the backend contract in
[docs/product/dashboards.md](../product/dashboards.md#backend-contract)). This plan implements them; it does not redesign them.

## Status

Built, and running on localhost with no outside account (`ACCOUNTS_DB=pglite`):

- sign-in with Better Auth on our own server: email magic link, Google and Apple when their keys
  are set, no passwords;
- dashboard sync per document with versions, local-first, newest edit wins. A change reaches the
  account's other devices through a WebSocket nudge and a pull; a device that missed it catches up
  when the tab returns, or within 30 seconds;
- the library server: publish, unpublish, add counts, reports that hold an entry back, handles,
  moderation settings (`LIBRARY_*`), all in [dashboards.md](../product/dashboards.md#library-alerts-and-push);
- alerts and Web Push, in the same API;
- the Free limit and the Pro tiles enforced by the API, from `PLAN_ENTITLEMENTS` in
  `shared/src/plans.ts`;
- payments behind one `PaymentProvider` interface: Stripe Checkout, portal and webhooks, and a fake
  provider with its own checkout page and signed webhooks for development and tests;
- the account page: plan, billing, export my data, delete my account (entries and handles go too).

Nothing in this plan is left to code. A published entry is a copy: the author's later edits
change it only when they publish again, by design.

## Still open

- **Test-mode Stripe run.** The fake provider covers the flows. A purchase and a cancel through Stripe's
  test mode need the owner's account and keys.
- **Sign-in providers.** Google and Apple stay off until their client ids exist (owner), and mail
  needs an SMTP account.
- **The split and prices.** Free is every ready-made dashboard, 3 of your own and share links; Pro
  is any number, Pro tiles and publishing. It stays a default until the owner confirms it, and
  [plan 2](02-hosted-preview.md)'s analytics should inform it.
- **VAT and sales tax** for digital goods across the EU, UK and US. Stripe Tax, or a merchant of
  record (Paddle or Lemon Squeezy), avoids registering everywhere. Owner decision.

## Done when

- A dashboard made on a laptop shows up on a phone signed into the same account.
- A test-mode Stripe purchase turns Pro on within seconds, and cancelling turns it off at the period end.
- The Free limit holds against direct API calls.
- Deleting an account removes its dashboards and published entries.

## Risks

- **VAT and sales tax** for digital goods sold across the EU, UK and US. Stripe Tax, or a merchant of record (Paddle or Lemon Squeezy), avoids registering everywhere. This is an owner decision.
- **App store rules** apply only if a native app ever ships. The web app sells directly.

## Needs from the owner

- A confirmed Free/Pro split and prices.
- A Stripe account (or a merchant of record) in the business's name, and an email service.
- A choice between our own auth and a hosted provider. Our own is what is built.
