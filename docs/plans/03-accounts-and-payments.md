# Plan 3: Accounts and payments

## Goal

Replace the in-browser mocks with real accounts:

- dashboards synced across devices;
- a real fan library;
- Pro paid through Stripe.

The mocks already define the behaviour and the payloads (see the backend contract in
[docs/product/dashboards.md](../product/dashboards.md#backend-contract)). This plan implements them; it does not redesign them.

## Before starting

- Confirm the Free/Pro split. The current default:
  - Free: every ready-made dashboard, 3 of your own, share links;
  - Pro: any number of dashboards, Pro tiles, publishing.
- Read the analytics from [plan 2](02-hosted-preview.md). If nobody uses a Pro tile, it should not be what Pro is sold on.

## Steps

1. **Sign-in.**
   - Email magic link plus Google and Apple, through a maintained auth library on our own server (Better Auth or Auth.js), or a hosted service (Clerk).
   - No passwords.
   - The demo account in `features/library/account.tsx` becomes the real dialog.
2. **Dashboard sync.**
   - `GET` and `PUT /me/dashboards`, validated with the same rules as `parseDashboardText`.
   - The browser store stays the offline copy. On sign-in, local dashboards merge into the account, with the last edit winning per dashboard.
   - Other devices pick up changes over the live socket.
3. **Library.**
   - `GET /library`, `POST /library` and `DELETE /library/:id` replace the sample entries in `community.ts`.
   - Count adds on the server.
   - Basic moderation: report an entry, and owner-only removal.
   - Published entries update when their dashboard does, which fixes the current snapshot-only mock.
4. **Payments.**
   - Stripe Checkout for monthly and yearly Pro, and the Stripe customer portal for cancelling and changing plan.
   - A webhook sets `plan` on the account.
   - The Free/Pro keys become a real plan read from the account. A "Preview Pro" trial of a few laps can stay as the upsell.
5. **Server-side limits.**
   - The Free limit of 3 dashboards and the Pro tiles are enforced by the API, not only hidden in the UI.
6. **Account page.**
   - Plan, billing portal, export all dashboards, and delete the account (removes everything).

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
- A Stripe account (or a merchant of record) in the business's name.
- A choice between our own auth and a hosted provider (cost against control).
