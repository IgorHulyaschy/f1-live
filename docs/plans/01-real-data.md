# Plan 1: Real race data

## Goal

The app stops running only on the modelled Las Vegas replay. Instead:

- any 2025 or 2026 race can be picked and replayed from the official timing data;
- during a live session, every screen updates within about a second of the feed.

Every tile works unchanged, because the server serves the same `RaceSnapshot` contract
(`shared/src/race.ts`) that the mock produces.

## Where we are

- **Server** (`server/src`):
  - It subscribes to the live feed over SignalR (`livetiming.client.ts`), but only to three topics: `TimingData`, `SessionInfo` and `DriverList`.
  - It stores lap times and every raw frame (the `logs` table).
  - It serves `GET /onLoad` with lap times only.
- **Client** (`client/src/data/api-source.ts`):
  - It rebuilds positions from summed lap times.
  - Tyres, stops, race control and weather come back empty, so most tiles are blank on the API source.
- **Samples:** `server/data-examples` holds one snapshot per topic from the 2025 Las Vegas race. These are the fixtures for everything below.
- **Blocker:** the cloud environment's network policy denies:
  - `livetiming.formula1.com`, needed for live and the static archive;
  - `api.openf1.org`, the fallback;
  - `media.formula1.com`, needed for pictures.

## Approach

**One reducer, two inputs.** The timing feed is a stream of topic frames, and the snapshot is what you get by applying them in order. So the whole system rests on a single pure function, `applyFrame(state, topic, data, timestamp)`, which builds up a `RaceSnapshot`.

- **Live:** frames from the SignalR connection go through the reducer. Snapshots or deltas are pushed to clients.
- **Past races:** the same reducer runs over the official static archive (`https://livetiming.formula1.com/static/<year>/<meeting>/<session>/<Topic>.jsonStream`, indexed by `Index.json`). It holds the same frames the live feed sent, so replays are exact, not modelled.
- **Fallback:** OpenF1 (`api.openf1.org`) maps onto the same contract if the archive is missing a session or a topic.

Because live and replay share one code path, every replay test also tests live.

## Steps

1. **Feed reducer in `shared/`.**
   - Write a pure `applyFrame` covering these topics: `SessionInfo`, `DriverList`, `TimingData`, `TimingAppData`, `TimingStats`, `LapCount`, `TrackStatus`, `RaceControlMessages`, `WeatherData`, `SessionStatus`.
   - The output is the existing `RaceSnapshot`, extended with session status and current gaps between lap crossings.
   - Unit tests replay `server/data-examples` and assert the snapshot against the known Las Vegas result: classification, stints, penalties and the VSC laps.
2. **Archive importer.**
   - Add a CLI, `npm run import -w server -- 2025 "Las Vegas"`, that fetches `Index.json` and the topic `.jsonStream` files.
   - It stores raw frames in `logs`, tagged with the session, then reduces them to a snapshot per lap.
   - It is idempotent per session. A `--from-dir` option imports saved files, so tests and CI never need the network.
3. **Season catalogue.**
   - Add a `sessions` table filled from the archive's season index: meeting, session type, start time, status.
   - Serve it from `GET /sessions`.
4. **Snapshot API.**
   - `GET /sessions/:id/snapshot` serves the full `RaceSnapshot`, cached in memory and on disk once a session ends.
   - Drop `/onLoad` once the client has moved over.
5. **Live push.**
   - Subscribe the live client to all of the topics in step 1, and run the reducer on every frame.
   - `WS /live` sends a full snapshot on connect, then per-frame deltas (topic plus patch). The client applies them with the same reducer.
   - The connection reconnects with backoff and resubscribes, and a heartbeat watchdog catches a stalled feed.
6. **Client data source.**
   - `api-source.ts` reads `RaceSnapshot` directly, and the hand mapping is deleted.
   - A session picker in the Session tile and the ⌘K palette lets you choose a meeting and session.
   - In live mode: the Replay tile shows "Live", stepping back pauses live, and a "Back to live" key returns to it.
   - The mock replay stays as the default for tests, screenshots and offline development.
7. **Sessions other than races.**
   - Practice and qualifying show the same timing order by best lap, with the gap to pole.
   - Race-only tiles (Box now, Battle) say they apply to races.
   - Sprints use the race path.

## Done when

- `npm run import -w server -- 2025 "Las Vegas"` produces a snapshot whose classification, stints and penalties match the real result. The test runs on saved files with no network.
- Any 2025 race picked in the app replays from real data, with every tile filled.
- During a live session, a lap completed on track shows on screen within about a second, and a dropped connection recovers on its own.
- The e2e suite still runs on the mock. A second e2e project runs against a saved real session.

## Risks

- **The feed is undocumented.** Topics, fields and URL patterns can change between seasons. This is why we keep raw frames, so a reducer fix can re-reduce stored sessions without fetching again.
- **Terms of use.** The live timing feed is for personal use. A paid product needs either a data agreement or a licensed provider. This is tracked in [plan 4](04-launch-readiness.md).
- **Load on race day.** One upstream connection fans out to every viewer through our own WebSocket, and we never connect per viewer.

## Needs from the owner

- Allow `livetiming.formula1.com`, `api.openf1.org` and `media.formula1.com` in the cloud environment's network access.
  - Project settings, Cloud environment, Add cloud environment, then Network access set to Custom.
- A Postgres database for the server, or permission to run one locally in the environment.
