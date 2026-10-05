# Plan 1: Real race data

## Goal

The app stops running only on the modelled Las Vegas replay. Instead:

- any session since 2018 can be picked and replayed from the official timing data;
- during a live session, every screen updates within about a second of the feed.

Every tile works unchanged, because the server serves the same `RaceSnapshot` contract
(`shared/src/race.ts`) that the mock produces.

## Architecture

```
 official archive         live feed (SignalR)        OpenF1 or a licensed provider
 <Topic>.jsonStream       topic frames               (later)
        |                        |                              |
        +------------+-----------+                              |
                     v                                          v
 server/src/sources/f1/: archive.ts, live.ts -> decode.ts   server/src/sources/<provider>/
                     |                                          |
                     +--------------------+---------------------+
                                          v
                     RaceEvent[]                      shared/src/events.ts
                                          |
                                          v
                     applyEvent(state, event)         shared/src/apply-event.ts (pure)
                                          |
                                          v
                     RaceSnapshot                     shared/src/race.ts
                                          |
                                          v
 server/src/sinks/: data/out/snapshots/<sessionKey>.json.gz, data/out/catalog.json, WebSocket /live
```

- **Sources** turn provider data into `RaceEvent`s: source-agnostic race facts such as a lap
  completed, a tyre fitted, a pit stop, a track status change or a penalty. Nothing past this
  point knows which provider sent them.
- **The reducer** `applyEvent` is one pure function in `shared/`. The server uses it to build
  snapshots; the client can apply live events with the same code.
- **Raw input is kept forever** in `data/raw/<archive path>/<Topic>.jsonStream`, in the archive's
  own line format. Everything else can be rebuilt from it, so a decoder fix only needs a rebuild.
- **Live is the same decoder.** A live recording is written in the archive format, and when the
  session ends the same import runs on it.
- **Sessions are keyed by the archive `Key`**, for example 9858, the 2025 Las Vegas race, at
  `2025/2025-11-22_Las_Vegas_Grand_Prix/2025-11-22_Race/`.
- **No relational database for race data.** Postgres only holds accounts, dashboards and
  subscriptions ([plan 3](03-accounts-and-payments.md)).
- `data/` is gitignored. Tests use small trimmed fixtures in the repository, and the full-session
  tests skip with a message when `data/raw` is missing.

## Status

Built, and running on this machine with no outside account:

- **Any session since 2018 replays from real data** (2022: see below), with the map and car data. The importer
  fetches whole seasons (`npm run import -w server -- 2018,2019`, or `--key 9858`) and
  `npm run rebuild -w server` derives every output again from `data/raw` with no network.
  Practice, qualifying, sprints and races all go through one path.
- **Live uses the same decoder.** `live.ts` records the feed in archive format, `WS /live` pushes
  to viewers, and `ingestSession` imports the session when it ends. A dropped connection reconnects
  with backoff, and a watchdog catches a stalled feed. `npm run replay-live -w server` replays a
  saved session through the same path when nothing is live.
- **Ingest and relay are split** for cloud hosts, because the feed answers 403 to them
  ([deploy.md](../deploy.md)).
- **Corrections.** OpenF1 supplies disqualifications and whole-second penalties, and
  `server/corrections/<key>.json` holds the rest, each citing its FIA document. The FIA stewards'
  decisions and Wikidata facts are fetched too, and Ask answers from them.
- **The client reads `RaceSnapshot` directly.** The session picker, ⌘K, "Live" and "Back to live"
  work, and a finished session stays spoiler-free until the viewer reveals it. The mock replay
  stays the default for tests and screenshots, and the real-data e2e project runs on committed
  fixtures.

## Still open

- **2022 and before 2018.** The archive's 2022 `Index.json` answers 403, so the season is built
  from a supplement (`server/src/catalog/index-supplement.ts`); every 2022 session still needs a
  check that it replays. The importer rejects years before 2018: that data needs another source
  (owner item).
- **Reclassifications of cars a lap down** are not found, because they have no gap to compare.
- **Import hardening** (T23 leftovers): free disk is checked once per session, not during its
  download; one request timeout (120 s) fits every file; the catalog's telemetry flag can lag
  behind an on-demand telemetry build.
- **A race weekend on the real feed.** Live has been proved on replays and recordings. The first
  real weekend is the test of "a lap shows within about a second" and of recovery from a dropped
  connection.

The rest of this list is in [What's next](README.md#whats-next).

## Risks

- **The feed is undocumented.** Topics, fields and URL patterns can change between seasons. This
  is why raw files are kept, so a decoder fix can rebuild stored sessions without fetching again.
- **Terms of use.** The live timing feed is for personal use. A paid product needs either a data
  agreement or a licensed provider. This is tracked in [plan 4](04-launch-readiness.md), and the
  event model is what lets a licensed provider replace the feed.
- **Load on race day.** One upstream connection fans out to every viewer through our own
  WebSocket, and we never connect per viewer.

## Needs from the owner

- The data-rights decision in [plan 4](04-launch-readiness.md) before charging.
- A source for 2022 and for seasons before 2018.
