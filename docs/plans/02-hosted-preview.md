# Plan 2: Hosted preview

## Goal

A private link the owner and a small group of fans can open during a Grand Prix weekend:

- on a phone, a laptop beside the TV, and a TV or wall monitor;
- with real data from [plan 1](01-real-data.md).

It should tell us which dashboards and tiles people actually keep.

## Shape

| Part    | Recommended                                       | Why                                                              |
| ------- | ------------------------------------------------- | ---------------------------------------------------------------- |
| Client  | Static build on Cloudflare Pages (or Vercel)      | The client is a static Vite app; previews per branch come free   |
| Server  | One small always-on container (Fly.io or Railway) | Holds the single upstream feed connection and the viewer sockets |
| Storage | A persistent volume on the server's host          | `data/`: raw feed files and snapshots; no database for race data |

These are recommendations; any host that runs a Node container and serves static files works.

## Status

Everything that needs no account is built ([deploy.md](../deploy.md)):

- `server/Dockerfile` and `client/Dockerfile`, and `docker compose up` for the whole stack on
  localhost, with a `replay` profile that plays a saved race through ingest, relay and browser;
- client settings for the API, socket and accounts URLs, and `CORS_ORIGINS` on the server;
- CI on every push: checks, unit tests, e2e, the image builds, the compose stack and the launch
  budgets. It has no deploy job and needs no secrets;
- host templates for Fly.io, Render, Cloudflare Pages with R2, and Netlify; a home ingest machine
  for the feed, which blocks cloud hosts; the upload script for saved sessions;
- `VITE_SITE_NOINDEX=true` for a private preview, and an analytics slot (`platform/analytics.ts`)
  that sends page paths only after the viewer consents, with no provider chosen.

## Still open

1. **Deploy pipeline.** A CI job that deploys `master` and pull requests. It needs the host
   accounts and their tokens as GitHub secrets (owner).
2. **Access.** A shared invite code or the host's own password protection while the preview is
   private. The host's feature is the cheaper route, so it waits for the host (owner).
3. **Analytics events.** Only page views are sent. The events that answer "what goes in Pro"
   (dashboards opened, tiles added or removed, presets reset, share links opened, Pro previewed,
   text size and Fit used) are not wired, and a provider (Plausible or Umami) is not chosen.
4. **Feedback.** The footer has a Support mail link. A "Send feedback" key carrying the page,
   dashboard JSON and lap is not built.
5. **Race-weekend runbook.** Written after the first weekend runs: warm the server before the
   session, watch the upstream connection, note what broke.

## Done when

- The preview loads on a phone, a 1280px laptop and a 4K TV, using real data for the current or last race.
- A live session runs end to end without a manual restart.
- After one race weekend there is a short readout:
  - the most kept dashboards;
  - the most removed tiles;
  - how often Pro was previewed;
  - every bug found.

## Needs from the owner

- Accounts on the chosen hosts, with deploy tokens added as GitHub secrets on Fybex/f1-live-private.
- The list of people to invite.
