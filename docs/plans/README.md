# Plans

Where Pitwall goes from a polished replay to a product people pay for. The screens are in good
shape, so the next steps are about real data, getting the app in front of fans, and only then
charging.

| #   | Plan                                                 | Outcome                                                         | Blocked on                                       |
| --- | ---------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| 1   | [Real race data](01-real-data.md)                    | Any 2025/2026 race replays from real data; live sessions update | Network access to `livetiming.formula1.com`      |
| 2   | [Hosted preview](02-hosted-preview.md)               | A link fans can open on any screen during a Grand Prix          | Hosting accounts (owner)                         |
| 3   | [Accounts and payments](03-accounts-and-payments.md) | Sign-in, dashboards synced across devices, Pro through Stripe   | Free/Pro split confirmed; Stripe account (owner) |
| 4   | [Launch readiness](04-launch-readiness.md)           | A name, legal pages, a picture licence or own artwork, support  | Owner decisions                                  |

The order matters:

- **1 before 2.** A preview on mock data shows the design but tests nothing a fan cares about.
- **2 before 3.** We learn which dashboards and tiles people keep before deciding what Pro holds.
- **4 runs alongside.** Its decisions take the longest and none of them need code.

## Decisions the owner holds

These are tracked here so no plan quietly decides them.

- **Free/Pro split.** The current default is in [docs/product/dashboards.md](../product/dashboards.md#free-and-pro):
  - Free: 3 of your own dashboards and share links;
  - Pro: any number of dashboards, Pro tiles and publishing.
- **Brand name.** The product can't use "F1" or "Formula 1".
- **Pictures.** License the F1 media, commission our own artwork, or ship with the drawn plates.
- **Hosting and billing accounts.** These are in the owner's name, not the project's.

## How each plan is run

- Every step is its own commit, with tests and a review pass (code, plus design from screenshots).
- Work lands on `master` of Fybex/f1-live-private. Nothing is pushed to the upstream repository.
- A plan is done when its "Done when" list passes on the hosted preview, not only locally.
