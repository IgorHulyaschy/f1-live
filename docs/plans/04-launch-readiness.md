# Plan 4: Launch readiness

Everything a paid launch needs that is not code. Most items are owner decisions, and several take weeks, so this plan runs alongside plans 1 to 3.

## Name and brand

- "Pitwall" is a working name. Check it for trademarks in the EU, UK and US, and for the domain and social handles. If it is taken, shortlist alternatives.
- Do not use "F1", "Formula 1", "Formula One", "Grand Prix" in the brand name, or team marks.
- Every page keeps the footer line saying the product is unofficial and not associated with the Formula 1 companies.
- The design identity already avoids F1 brand assets (`docs/design/identity.md`).

## Data rights

- The live timing feed is published for personal use. Before charging, pick one of these:
  - a data agreement with Formula One Management;
  - a licensed data provider;
  - limiting the paid tier to analysis we derive ourselves, while the free tier shows the raw timing.
- Get legal advice on which one fits.
- [Plan 1](01-real-data.md) keeps raw frames separate from derived insights, so any of these options can be applied without a rewrite.

## Pictures

Driver photos, team logos and cars currently load from formula1.com in the viewer's browser, and are not stored in the repository (`client/src/lib/media.ts`). For a paid product, pick one:

| Option                     | Cost                  | Notes                                                     |
| -------------------------- | --------------------- | --------------------------------------------------------- |
| Licence F1 / team media    | Licence fee, approval | The real photos; brand rules apply                        |
| Commission our own artwork | One-off per season    | Illustrated plates or helmets in our identity; fully ours |
| Drawn plates only          | None                  | Ships today (`VITE_F1_MEDIA=off`); least emotional pull   |

The recommendation is drawn plates at launch, then our own artwork. A licence is worth it only if the numbers from [plan 2](02-hosted-preview.md) show pictures drive use.

## Legal pages

- Terms of service.
- A privacy policy covering accounts, analytics and Stripe.
- A cookie notice, needed only if analytics sets cookies; the recommended setup does not.
- An imprint, where the business's country requires one.
- Data deletion and export are already covered by the account page in [plan 3](03-accounts-and-payments.md).

## Support and operations

- A support email, and a status note for race-day outages.
- Error reporting (Sentry or similar) on the client and server.
- A race-weekend runbook, built from [plan 2](02-hosted-preview.md)'s checklist.

## Done when

- A cleared name and domain.
- A chosen data route, with legal sign-off.
- A chosen picture option.
- Published terms and privacy policy.
- A support channel and error reporting live before the first paid sign-up.
