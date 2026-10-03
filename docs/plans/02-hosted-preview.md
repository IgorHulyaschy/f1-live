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

## Steps

1. **Build and config.**
   - Add a production `Dockerfile` for the server.
   - Client environment variables for the API URL and data source.
   - Restrict CORS to the preview origin; `main.ts` already has the TODO.
2. **Deploy pipeline.**
   - GitHub Actions on Fybex/f1-live-private runs the existing checks: format, lint, typecheck, unit
     and e2e.
   - Then it deploys `master` to production and pull requests to preview URLs.
3. **Access.**
   - A shared invite code, or the host's own password protection, while the preview is private.
   - Pages carry `noindex`.
4. **Analytics without tracking people.**
   - Use a privacy-friendly counter (Plausible or self-hosted Umami).
   - Count events, not people: dashboards opened, tiles added or removed, presets reset, share links opened, Pro previewed, text size and Fit used.
   - These answer what goes in Pro.
5. **Feedback.**
   - A "Send feedback" key in the footer, carrying the page, dashboard JSON and lap. It opens an email draft or a form, so no backend is needed.
6. **Race-weekend checklist** (in this folder once the first weekend runs):
   - Warm the server before the session.
   - Watch the upstream connection.
   - Note what broke.

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
