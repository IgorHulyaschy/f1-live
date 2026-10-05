# Plans

Where Pitwall stands on 2026-10-05, and what is left before a paid launch. The product is built and
runs fully on localhost: real data for every session since 2018, live and replay, accounts with
fake payments, Ask, pictures, tile dashboards, race watching and a map-first race page. Each
plan below has a Status section. What remains waits on the owner, with a few small fixes in
[What's next](#whats-next).

| #   | Plan                                                 | Status                                                                | Blocked on                                            |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | [Real race data](01-real-data.md)                    | Built; 2022 and pre-2018 data and import hardening are open           | Another data source for 2022 and earlier (owner)      |
| 2   | [Hosted preview](02-hosted-preview.md)               | Images, compose stack, CI and host templates built; no deploy job yet | Hosting accounts and tokens (owner)                   |
| 3   | [Accounts and payments](03-accounts-and-payments.md) | Built on localhost, with a fake payment provider                      | Stripe and email accounts, confirmed split and prices |
| 4   | [Launch readiness](04-launch-readiness.md)           | Every decision has a working default slot; the decisions are not made | Owner decisions                                       |

The order that mattered, and still does for the launch:

- **1 before 2.** A preview on mock data shows the design but tests nothing a fan cares about.
- **2 before 3.** We learn which dashboards and tiles people keep before deciding what Pro holds.
- **4 runs alongside.** Its decisions take the longest and none of them need code.

## What's next

Each item was checked against the code on 2026-10-05.

- **Stopped cars.** A red flag or the chequered flag can retire a car as "Stopped" (`onStopped` in `server/src/sources/f1/decode.ts` ignores the session status).
- **Race control headline.** It clips after two lines (`line-clamp-2` in `components/console/panel.tsx`).
- **2022 and before 2018.** 2022's `Index.json` answers 403 and runs on a supplement; earlier years are refused.
- **Outside-host guard.** Only specs that use `client/e2e/fixtures.ts` have it; `real`, `live`, `stack`, `build` and the shots do not.
- **Snapshots.** Served from disk on every request; decide whether a bounded in-memory cache is worth it.
- **Import hardening.** No disk check during a download, one 120 s timeout, and a catalog telemetry flag that can lag.
- **Wikidata facts.** Driver facts have no first-race entry (`shared/src/facts.ts`).
- **Preview extras.** Analytics events, a feedback key and the runbook ([plan 2](02-hosted-preview.md#still-open)).
- **A final review and polish pass** over the whole product before the first preview.

## Decisions the owner holds

All of them, in one place. The default each plan uses meanwhile is in its own file.

- **Data rights for the live feed.** An agreement with the rights holder, a licensed provider, or a paid tier built on our own analysis only ([plan 4](04-launch-readiness.md#data-rights)).
- **Hosting for a public preview.** Accounts and deploy tokens for the relay, static hosting and the home ingest machine ([deploy.md](../deploy.md#owner-checklist)).
- **Name, trademark and domain.** The brand can't use "F1" or "Formula 1". Pitwall is a working name ([research](../research/naming.md)); `client/src/brand.ts` holds it.
- **Stripe, prices and legal pages.** A Stripe account or merchant of record, the Free/Pro split ([default](../product/dashboards.md#free-and-pro)), prices, and reviewed terms and privacy text.
- **The picture licence.** Licence the media, commission artwork, or ship the drawn plates (`VITE_F1_MEDIA=off`).
- **VAPID push keys.** `npm run vapid -w server` makes them; the owner keeps `VAPID_PRIVATE_KEY` and a contact for `VAPID_SUBJECT`.
- **A data source for 2022 and before 2018.**
- **An LLM resolver for Ask.** Ask is a rule-based resolver today (`shared/src/ask.ts`); a model for free-form questions needs a provider and a budget.
- **A contact address for the FIA document fetcher.** Fetchers send `CONTACT` in their User-Agent; it reads "contact unset" until the owner sets it.
- **Email, Google and Apple accounts** for sign-in, in the owner's name.

## How each plan is run

- Every step is its own commit, with tests and a review pass (code, plus design from screenshots).
- Work lands in Fybex/f1-live-private. Each task has its own branch from `master`, and the
  coordinator squashes it into `master` as one commit once its checks and review pass locally; CI
  then runs on `master`. Task branches never push to `master` themselves.
- A plan is done when its "Done when" list passes on the hosted preview, not only locally.
