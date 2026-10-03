# Plan 1: Real race data

## Goal

The app stops running only on the modelled Las Vegas replay. Instead:

- any 2025 or 2026 session can be picked and replayed from the official timing data;
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

## Where we are

- **Server** (`server/src`): the first version subscribes to three topics, stores lap times and
  raw frames in Postgres, and serves `GET /onLoad` with lap times only. The steps below replace it.
- **Client** (`client/src/data/api-source.ts`): it rebuilds positions from summed lap times, so
  tyres, stops, race control and weather are blank on the API source.
- **Network:** `livetiming.formula1.com` (live and the static archive) and `api.openf1.org` are
  reachable from the development machine.

## Steps

1. **Event model and reducer** in `shared/`.
   - `RaceEvent` covers session info and status, driver entries, the grid, completed laps with
     sectors, positions and gaps, tyres, pit lane in and out with lane time, track status,
     race control, weather, retirements, penalties, personal bests and classification
     corrections.
   - `applyEvent` builds the `RaceSnapshot`, extended with the session status, live standings
     between lap crossings, the track status log, penalties and corrections.
2. **F1 decoder and archive reader** in `server/src/sources/f1/`.
   - `decode.ts` turns topic frames into events. It keeps a merged state per topic, because the
     feed sends partial updates, and it is the same for live frames.
   - `archive.ts` reads `<Topic>.jsonStream` files and merges them into one time-ordered stream.
   - `npm run fetch:f1 -w server -- 9858` downloads a session into `data/raw`.
   - A full-session test replays the 2025 Las Vegas race and checks it against the official result.
3. **Live recorder.**
   - `live.ts` subscribes to every topic the decoder reads and writes the frames to `data/raw` in
     the archive format, while feeding the decoder.
   - It reconnects with backoff and resubscribes, and a heartbeat watchdog catches a stalled feed.
4. **Import and outputs** in `server/src/import/`, `server/src/sinks/files.ts` and `server/src/catalog/`.
   - `npm run import -w server -- 2025 "Las Vegas"`, `-- 2025,2026` (whole seasons), `-- --key 9858`
     or `-- --from-dir <raw root> [--key <k>]` for live recordings. `--data-dir` (or `DATA_DIR`)
     moves `data/`; `--offline` uses no network.
   - It saves each session's `Index.json` and topic files to `data/raw/<archive path>/`. A session
     that ended more than three hours ago and has every file is skipped without a request, a
     missing file is fetched alone, and requests retry with backoff and a concurrency limit.
   - Per session: raw, then the decoder, then `RaceEvent[]`, then `applyEvent`, then
     `data/out/events/<key>.jsonl.gz` and `data/out/snapshots/<key>.json.gz`. A topic that fails to
     decode goes to `data/out/errors/<key>.json` and the batch goes on. The same raw files give
     the same bytes.
   - `data/out/catalog.json` lists seasons, meetings and sessions from the seasons' `Index.json`,
     upcoming sessions too, with each session's status and the outputs it has.
   - `npm run rebuild -w server` derives every output again from `data/raw` with no network. It is
     the way to ship a decoder fix.
   - `ingestSession({ rawDir, key, dataDir })` (`server/src/import/ingest.ts`) is the one function
     the live server calls when a session ends.
5. **Corrections.** Decisions taken after the feed ends, such as the McLaren disqualifications at
   the 2025 Las Vegas race, are added as classification correction events after the session's own
   events. Two sources, the later winning a conflict for the same driver and kind:
   - OpenF1 (`server/src/sources/openf1/`): the session result's disqualifications, and the
     whole-second time penalties, applied or withdrawn, found by comparing its race times with the
     feed's final gaps. The responses are saved to `data/openf1/` so a rebuild needs no network.
     Cars a lap down have no gap to compare, so their reclassification is not found.
   - A committed file `server/corrections/<key>.json` (format in its README) for anything else.
6. **Client data source.**
   - The API source reads `RaceSnapshot` directly, and the hand mapping is deleted.
   - A session picker in the Session tile and the ⌘K palette lets you choose a meeting and session.
   - In live mode the Replay tile shows "Live", stepping back pauses live, and a "Back to live" key
     returns to it.
   - The mock replay stays as the default for tests, screenshots and offline development.
7. **Sessions other than races.**
   - Practice and qualifying show the same timing order by best lap, with the gap to pole.
   - Race-only tiles (Box now, Battle) say they apply to races.
   - Sprints use the race path.
8. **OpenF1 source.** It maps onto the same events if the archive is missing a session or a topic.

## Done when

- `npm run import -w server -- 2025 "Las Vegas"` produces a snapshot whose classification, stints and penalties match the real result. The test runs on saved files with no network.
- Any 2025 race picked in the app replays from real data, with every tile filled.
- During a live session, a lap completed on track shows on screen within about a second, and a dropped connection recovers on its own.
- The e2e suite still runs on the mock. A second e2e project runs against a saved real session.

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
- For cloud runs only: allow `livetiming.formula1.com`, `api.openf1.org` and `media.formula1.com`
  in the cloud environment's network access.
