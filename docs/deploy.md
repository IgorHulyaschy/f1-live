# Deploying Pitwall

Everything technical is done: images, a one-command local stack, CI, host templates and the upload
script. What is left is the owner's accounts, keys, domain and one machine at home.

## The shape

F1's feed (`livetiming.formula1.com`) answers 403 to cloud hosts, so production is three parts:

```
home/office machine             cloud                                  static hosting / CDN
┌──────────────┐  push events   ┌──────────────────────────┐           ┌─────────────────────────┐
│ ingest       │ ─────────────▶ │ relay + API (one machine)│           │ client (Pages/Netlify)  │
│ MODE=ingest  │  RELAY_SECRET  │ MODE=relay, Postgres     │◀── WS ────│ saved sessions (bucket) │
└──────────────┘                │ /live  /api  /health     │   /api    └─────────────────────────┘
       │ import on finish       └──────────────────────────┘                  ▲
       └─ DATA_DIR/out ── deploy/scripts/upload-data.sh ───────────────────────┘
```

- **Ingest** reads the feed, records it to `DATA_DIR/raw`, pushes events to the relay, and imports
  the session when it ends into `DATA_DIR/out`.
- **Relay + API** holds the live session in memory, fans it out over `WS /live`, and serves
  accounts, dashboards and payment webhooks. One image runs every mode: `server/Dockerfile`.
- **Static hosting** serves the client build and `DATA_DIR/out` (catalog, snapshots, telemetry).

The relay keeps live state in memory, so it is exactly one instance. Viewers reconnect and resync
on a restart; a push from ingest after a restart re-sends the full state.

## Try it on this machine

Needs Docker with Compose. One command:

```sh
docker compose up --build
```

| URL                           | What                                                            |
| ----------------------------- | --------------------------------------------------------------- |
| http://localhost:8080         | The client (production build, Caddy)                            |
| http://localhost:8080/data/   | Saved sessions as static files (`catalog.json`, `snapshots/…`)  |
| http://localhost:3300/health  | Relay liveness; `/ready` is readiness                           |
| `/api/dev/mailbox?to=<email>` | The latest sign-in link for an address, under either host above |

The default data is the three-session fixture in `client/e2e/real/data`. To use the full import,
set `DATA_DIR` in a `.env` file (copy `.env.example`). Profiles add containers:

```sh
docker compose --profile replay up      # replay-live: a trimmed 2025 Las Vegas race, ingest -> relay -> browser
docker compose --profile ingest up      # a real ingest; needs a network the F1 feed does not block
docker compose down -v                  # stop and delete the Postgres volume
```

With `replay` running, open http://localhost:8080/ : the app goes to the live race (about 35 s after
the start, at the default `REPLAY_SPEED=100`). Sign-in works with the dev mailbox and Pro with the
fake checkout, because the app is on localhost. `npm run test:stack -w client` checks all of it
(`STACK_REPLAY=1` adds the live path).

## CI

`.github/workflows/ci.yml` runs on every push to `master` or `m1` and every pull request. It has no
deploy job and needs no secrets.

| Job     | Runs                                                                                            |
| ------- | ----------------------------------------------------------------------------------------------- |
| `check` | `npm ci` (cached), `npm run check`, `npm run test:unit`                                         |
| `e2e`   | Playwright: mock replay, real-data fixtures, live replay. Report and traces upload on failure   |
| `build` | The client production build, then both images (layer cache), with their sizes                   |
| `stack` | `docker compose --profile replay up`, then `test:stack`: saved session, sign-in, checkout, live |

The marked block at the end of the file is where the Lighthouse and accessibility budget job goes.

## Environment

Generate the secrets you make yourself with `deploy/scripts/gen-secrets.sh`. Every setting is
documented in `server/.env.example` and `client/.env.example`; these are the ones production needs.

**Relay + API** (the same image as ingest, `MODE=relay`):

| Variable                                                                                            | Value                                                 |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `MODE`, `NODE_ENV`                                                                                  | `relay`, `production`                                 |
| `DATABASE_URL`                                                                                      | Postgres connection string (the host's, or Neon etc.) |
| `RELAY_SECRET` (secret)                                                                             | generated; the same value on the ingest machine       |
| `BETTER_AUTH_SECRET` (secret)                                                                       | generated, 32+ characters                             |
| `APP_URL`, `CORS_ORIGINS`                                                                           | `https://app.<domain>`                                |
| `ACCOUNTS_PUBLIC_URL`                                                                               | `https://api.<domain>`                                |
| `COOKIE_DOMAIN`                                                                                     | `<domain>`: the cookie is shared by app and api hosts |
| `SMTP_URL`, `MAIL_FROM` (secret)                                                                    | your email service                                    |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY` | from Stripe                                           |
| `GOOGLE_CLIENT_ID/SECRET`, `APPLE_CLIENT_ID/SECRET`                                                 | optional; a provider is on only with both values      |

In production the server refuses to start with a missing or development value and lists every
problem at once.

**Ingest** (`deploy/home-ingest/env.example`): `RELAY_URL=https://api.<domain>`, the same
`RELAY_SECRET`, `F1TV_TOKEN` (optional, but without it the feed withholds car data and positions)
and `DATA_DIR`.

**Client build** (baked in at build time, so one build serves one environment):

| Variable            | Value                                                |
| ------------------- | ---------------------------------------------------- |
| `VITE_DATA_SOURCE`  | `api`                                                |
| `VITE_API_URL`      | `https://data.<domain>`: the bucket's public address |
| `VITE_WS_URL`       | `wss://api.<domain>/live`                            |
| `VITE_ACCOUNTS_URL` | `https://api.<domain>`                               |

Two small settings exist for this: `COOKIE_DOMAIN` (sign-in cookie across `app.` and `api.`) and
`DEV_MAILBOX_ANY_IP` (compose only). With `docker compose` the app, `/api` and `/live` share one
origin, so neither is needed.

## Owner checklist

1. **Domain.** One domain; DNS records for `app.`, `api.` and `data.` come from the steps below.
2. **Postgres and the relay**, on Fly.io or Render (below). Set the secrets, deploy, open
   `https://api.<domain>/ready`.
3. **Static hosting**: Cloudflare Pages + R2 or Netlify (below). Build the client with the values
   above, upload the data.
4. **Stripe**: create the Pro prices and a webhook to `https://api.<domain>/api/billing/webhook`;
   copy the keys and price ids into the relay's secrets. **Email**: an SMTP account and a verified
   sender for `MAIL_FROM`.
5. **Ingest at home**: a machine that stays on and has an ordinary home or office connection.
   `docker compose -f deploy/home-ingest/docker-compose.yml --env-file deploy/home-ingest/.env up -d --build`.
   Check `http://127.0.0.1:3000/health` there, and the relay's `/health`: `seq` rises during a
   session.
6. **After each session**: the ingest box imports on finish. Run
   `deploy/scripts/upload-data.sh` there to publish the new `out/` files.

Organizational items still open: the brand name (`BRAND_NAME`, emails and payment pages use it),
the domain, hosting/Stripe/email/Google/Apple accounts, the F1 data-rights agreement and the
picture licence.

### Relay + API on Fly.io

```sh
fly launch --no-deploy --copy-config --config deploy/fly/fly.toml --dockerfile server/Dockerfile
fly postgres create          # or any Postgres; attach it so DATABASE_URL is set
fly secrets set --config deploy/fly/fly.toml RELAY_SECRET=… BETTER_AUTH_SECRET=… SMTP_URL=… \
  STRIPE_SECRET_KEY=… STRIPE_WEBHOOK_SECRET=… STRIPE_PRICE_PRO_MONTHLY=… STRIPE_PRICE_PRO_YEARLY=…
fly deploy --config deploy/fly/fly.toml --dockerfile server/Dockerfile
fly certs add api.<domain>   # then the DNS record it prints
```

Edit the public values in `deploy/fly/fly.toml` first (`APP_URL`, `CORS_ORIGINS`,
`ACCOUNTS_PUBLIC_URL`, `COOKIE_DOMAIN`). Migrations run when the server starts.

### Relay + API on Render

New > Blueprint, pick the repository and `deploy/render/render.yaml`. It creates the web service and
the Postgres; fill in the `sync: false` values when asked. Add `api.<domain>` as a custom domain.

### Static hosting: Cloudflare Pages and R2

```sh
# The client
VITE_DATA_SOURCE=api VITE_API_URL=https://data.<domain> VITE_WS_URL=wss://api.<domain>/live \
  VITE_ACCOUNTS_URL=https://api.<domain> npm run build -w client
node deploy/scripts/precompress.mjs client/dist      # optional: Pages compresses on its own
cp deploy/static/_headers deploy/static/_redirects client/dist/
npx wrangler pages deploy client/dist --project-name pitwall

# The data: create the bucket, give it the CORS rule and a custom domain data.<domain>
npx wrangler r2 bucket create pitwall-data
npx wrangler r2 bucket cors set pitwall-data --file deploy/cloudflare/r2-cors.json
BUCKET=pitwall-data S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com \
  AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=… deploy/scripts/upload-data.sh
```

Create the R2 access key in the Cloudflare dashboard (R2 > Manage API tokens). Add `app.<domain>` to
the Pages project and `data.<domain>` to the bucket as custom domains.

### Static hosting: Netlify

`netlify deploy --prod --dir client/dist` after the build above (with `_headers` and `_redirects`
copied in), or connect the repository and put `deploy/netlify/netlify.toml` at its root. Netlify
holds the client only; the data goes to any S3-compatible bucket with `upload-data.sh`
(Cloudflare R2 is the cheapest there, below).

## Cost sketch

List prices at the time of writing; check each page before you commit. Taxes and a domain
(about $10 to $15 a year) are extra.

| Part           | Option                      | Monthly                                                                                                                    |
| -------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Relay          | Fly.io shared-cpu-1x 512 MB | $3.69 ([pricing](https://docs.fly.io/about/pricing)); no free tier for new organizations                                   |
| Relay          | Render Starter (512 MB)     | $7 ([pricing](https://render.com/pricing))                                                                                 |
| Postgres       | Fly Managed Postgres Basic  | $38 + $0.28 per GB ([pricing](https://docs.fly.io/about/pricing)); or a free-tier Postgres elsewhere                       |
| Postgres       | Render Basic-256mb          | $6 + $0.30 per GB ([pricing](https://render.com/pricing))                                                                  |
| Client         | Cloudflare Pages            | $0 on the free plan: 500 builds a month, 20,000 files ([limits](https://developers.cloudflare.com/pages/platform/limits/)) |
| Client         | Netlify                     | Free plan has a 300-credit limit; Pro is $20 ([pricing](https://www.netlify.com/pricing/))                                 |
| Saved sessions | Cloudflare R2               | $0.015 per GB, 10 GB free, no egress fee ([pricing](https://developers.cloudflare.com/r2/pricing/))                        |

A season of saved sessions is about 1 GB of `out/` (the real import is 1.1 GB for 207 sessions),
so R2 is under $0.02 a month plus requests inside the free allowance. A first small setup is Fly
(or Render) at $4 to $7, a Postgres at $6 to $38, and everything else at $0: **roughly $10 to
$45 a month**. Bandwidth for the relay is the cost to watch on a busy race: Fly charges $0.02 per
GB in North America and Europe. The ingest machine is one you already own.

## Operations

- **Logs** are one JSON line per event on stdout (pino). `LOG_LEVEL` sets the level. Requests carry
  a `reqId`; `/health` and `/ready` are not logged. Both hosts collect stdout.
- **Liveness and readiness.** `GET /health` says the process is up: restart on failure. `GET /ready`
  says it can serve: it checks the accounts database and answers 503 once shutdown has begun. Point
  the host's load-balancer check at `/ready` and its restart check at `/health`. The images'
  `HEALTHCHECK` uses `/health`.
- **Graceful shutdown.** `SIGTERM` stops the live feed, closes viewer sockets, finishes the
  import and closes the database; a hung shutdown is forced out after 8 s. The images run under
  tini and compose sets `stop_grace_period: 15s`; the relay stops in about a second.
- **Migrations** run when the relay starts, under their own journal table (`accounts.*` tables
  only). Two relays starting together is not supported anyway: run one.
- **Backups.** Postgres holds accounts, dashboards and subscriptions. Turn on the host's automatic
  backups and test one restore. A manual dump:
  `docker compose exec -T postgres pg_dump -U pitwall -d pitwall -Fc > pitwall.dump` and back with
  `pg_restore --clean --if-exists -d <url> pitwall.dump`. Race data is not in the database: back up
  `DATA_DIR/raw` on the ingest machine, because everything else can be rebuilt from it.
- **Race weekend**: start the ingest box before the session, watch the relay's `/health` (`seq`
  rises, `viewers` counts sockets), upload `out/` afterwards.
