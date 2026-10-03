# Live protocol: `WS /live`

How the client follows a session that is running now. One socket carries the whole session:
first its full state, then the race events that change it. The client folds the events into the
state with `applyEvent` from `shared/`, the same function the server uses, so a live viewer and
a saved session run the same code.

- Endpoint: `ws://<host>/live` (`wss://` behind TLS), same port as the HTTP routes.
- Version: every message has `"v": 1`. A change to a message's shape bumps `v`.
- Messages are JSON text. The client sends `{"type":"resync"}`, and may opt in to the telemetry
  channels below.
- The server checks `Origin` against `CORS_ORIGINS`; a page from another origin gets 403.
  Clients that send no `Origin` (scripts, tools) are let in.

## Messages from the server

**`state`**: everything the client needs. Replace all local state with it.

```json
{
	"v": 1,
	"type": "state",
	"epoch": "5d1c0b0e-…",
	"sessionId": "9858",
	"seq": 1342,
	"at": 1763870000123,
	"snapshot": { "session": {}, "laps": [] }
}
```

`snapshot` is a `RaceSnapshot` (`shared/src/race.ts`), which carries the session and its optional `status`.
`sessionId` is the archive key (9858 is the 2025 Las Vegas race), or `null` before the server has
seen any session; the snapshot is then empty. `seq` is the number of the last event the snapshot
holds. `at` is the server clock in ms since the Unix epoch.

**`events`**: events that follow the client's state, in order.

```json
{ "v": 1, "type": "events", "epoch": "5d1c0b0e-…", "from": 1343, "at": 1763870000456, "events": [] }
```

Event `i` of `events` is number `from + i`. Each one is a `RaceEvent` (`shared/src/events.ts`).
A batch holds everything that arrived in one server tick, so it can be one event or several
hundred. `at` is when the server applied the first of them: `Date.now() - at` is the delay the
server and the network added.

**`heartbeat`**: `{ "v": 1, "type": "heartbeat", "epoch": "…", "seq": 1350, "at": 1763870020456 }`
every `WS_PING_SECONDS` (20 by default). It tells a quiet feed (a red flag, the gap before a
session) from a dead connection: if nothing at all has come for 2 intervals, reconnect.

## Telemetry channels (opt-in)

Car positions and car data are not race events. They are 3 to 4 samples a second for every car,
and the live feed sends them only with an F1 TV token (`F1TV_TOKEN`). A viewer that has no track
map never receives them, and the server decodes nothing while no viewer wants a channel.
Messages of the other types above are unchanged, and a client that never subscribes sees the
protocol exactly as before. There is no new version: `"v"` stays 1.

The client sends `{"type":"subscribe","channel":"positions"}` or `"car_data"`, and
`{"type":"unsubscribe","channel":"…"}` to stop. An unknown channel is ignored. Every subscribe
and unsubscribe is answered with the message below, which is also sent unasked when the feed
first sends a channel the viewer has subscribed to:

```json
{
	"v": 1,
	"type": "channels",
	"subscribed": ["positions"],
	"live": { "positions": true, "car_data": false }
}
```

`live` says whether the feed is sending that channel. It goes `false` when the channel has been
silent for 30 seconds, and the channel's last message is then dropped. When it stays `false` (no
token), use the saved session's replay file instead (`docs/product/telemetry.md`). A new
subscriber is sent the last message of a live channel, so it need not wait for the next one.

**`positions`**: at most 4 a second, whole metres, in the same frame as the circuit outline.

```json
{
	"v": 1,
	"type": "positions",
	"at": 1763870480250,
	"cars": { "1": [332, 198, 1], "44": [-120, 410, 0] }
}
```

`cars` maps a racing number to `[x, y, onTrack]`, with `onTrack` 1 or 0. `at` is the time of
the newest sample, ms since the Unix epoch. A car keeps its last place until it is sent again.

**`car_data`**: at most 4 a second.

```json
{ "v": 1, "type": "car_data", "at": 1763870480312, "cars": { "1": [121, 3, 57, 0, 9349, 0] } }
```

`cars` maps a racing number to `[speed km/h, gear, throttle %, brake, rpm, drs]`: gear 0 is
neutral, `brake` and `drs` are 1 or 0, and `drs` is always 0 in seasons without DRS.

Both are throttled on the server, so a burst of frames is one message, and both count against
`WS_MAX_BUFFER_BYTES` like every other message. Every mode that serves viewers sends them. An
`ingest` has no viewers, so it forwards both channels, throttled and batched the same way, to the
relay, which sends them only to the viewers that subscribed (see Modes below).

## Epoch and sequence numbers

An **epoch** is one run of event numbers. `seq` is only comparable inside one epoch. A new
epoch starts when a different session begins, and when a server starts over (a relay that was
restarted). When the epoch changes the server sends a new `state` to every connected client, so
a client only has to treat `state` as "replace everything".

## What the client does

```
state     -> epoch = m.epoch; seq = m.seq; snapshot = m.snapshot
events    -> if m.epoch != epoch or m.from > seq + 1:  send {"type":"resync"}
             otherwise skip the first (seq + 1 - m.from) events (already in the state),
             apply the rest in order, seq += 1 for each
heartbeat -> if m.epoch != epoch: send {"type":"resync"}
```

Skipping is normal: a client that connects while a batch is being sent receives the state and
then a batch that overlaps it. `server/src/live/replica.ts` is this algorithm as code and the
reference for the client.

`{"type":"resync"}` makes the server answer with a fresh `state` on the same socket.

## Connecting and reconnecting

| URL                               | First message                                                             |
| --------------------------------- | ------------------------------------------------------------------------- |
| `/live`                           | `state`                                                                   |
| `/live?epoch=<epoch>&since=<seq>` | `events` from `since + 1` (empty if the client is up to date), or `state` |

A reconnecting client sends the `epoch` and `seq` it holds. If the epoch is the current one and
the server still keeps the events after `seq` (the last `LIVE_LOG_EVENTS`, 100 000 by default,
about 5 hours of racing, mini sectors included), the reply is exactly the missed events (up to 5000; more gets a `state`). Otherwise (another epoch, an
`epoch` the server does not know, a `seq` older than the log or ahead of the server) the reply is
a full `state`. A client does not need to tell which case it is in: it handles whichever message
comes first.

Reconnect after a drop with exponential backoff and jitter (1 s, 2 s, 4 s, up to 30 s). A server
restart is a drop like any other.

## Keeping the connection healthy

- The server sends a WebSocket ping every `WS_PING_SECONDS` and closes a client that does not
  answer the next one. Browsers answer pings on their own.
- A client whose unsent data passes `WS_MAX_BUFFER_BYTES` (4 MiB by default; the final state of a
  race is about 260 KiB) is disconnected, so one slow link cannot hold memory or slow the others.
  It reconnects as above and catches up.
- Messages from the client larger than 1 KiB close the connection.

## Behind the server

```
live feed -> LiveFeed -> RawWriter (data/raw, archive format)
                      -> F1Decoder -> RaceEvent[] -> LiveSession (applyEvent, seq, event log)
                                                      -> LiveHub -> viewers
                      -> LiveTelemetry (Position.z, CarData.z; throttled) -> LiveHub -> subscribers
```

When the session reports `Finished`, `Finalised` or `Ends`, the server waits
`IMPORT_DELAY_SECONDS` and runs `npm run import -w server -- --from-dir <raw root> --key <key>`,
so the session becomes a saved file served from `<DATA_DIR>/out`, with its telemetry when the
recording has `Position.z` (see [telemetry.md](telemetry.md)). If that command does not exist, it
logs `import-skipped` and moves on.

### Modes

One codebase, chosen by `MODE`:

| Mode     | Reads the feed | Serves viewers | For                                                    |
| -------- | -------------- | -------------- | ------------------------------------------------------ |
| `all`    | yes            | yes            | local development                                      |
| `ingest` | yes            | no             | a machine the feed does not block (home, office)       |
| `relay`  | no             | yes            | the cloud host: the feed answers 403 to cloud networks |

`ingest` pushes its events to `RELAY_URL` over HTTP with `Authorization: Bearer <RELAY_SECRET>`:

- `POST /ingest/events` `{ epoch, from, events }` appends events. The relay answers `200
{ epoch, seq }`, or `409 { epoch, seq }` when it is somewhere else (a gap, another epoch).
  Events it already has are skipped, so a retry is harmless. An event the reducer cannot apply is
  skipped and logged as `ingest-event-skipped`; it keeps its number, so the ingest does not send
  the batch again, and the gap makes the viewers resync.
- `POST /ingest/state` `{ …state message }` replaces the relay's copy.
- `POST /ingest/channels` `{ messages: [positions and car_data messages] }` carries the telemetry
  channels: the messages of one 250 ms tick in one request. The relay marks each channel live,
  sends the message to the viewers subscribed to it and answers `200 { wanted: [...] }`, the
  channels some viewer is subscribed to. The ingest decodes and pushes only those; while none is
  wanted it sends an empty `messages` list every 3 seconds to ask again. The channels are a live
  picture, not a log: nothing is kept for an outage, a push that fails is dropped, and while one is
  in flight only the newest message of each channel waits.

The secret travels with every push, so use `https` for `RELAY_URL`. The ingest logs
`relay-url-insecure` at startup when it is plain `http` to a host other than loopback.

The relay does not run the import, so it has no saved sessions of its own; a CDN or the ingest host serves `<DATA_DIR>/out`.

The ingest keeps its own event log, which is the retry buffer: after an outage it asks where the
relay stands and resends from there, or sends the whole state when the log no longer reaches back
or the relay restarted. A catch-up longer than 5000 events is answered with a `state` instead. The relay keeps the ingest's epoch and numbers, so a viewer's `since`
survives a relay restart.

## Try it without a live session

```sh
npm run fetch:f1 -w server -- 9858            # once: downloads the 2025 Las Vegas race
npm run replay-live -w server -- --key 9858 --speed 10
```

`replay-live` plays the saved session through a fake upstream that speaks the live feed's
protocol, so the whole live path runs: recorder, decoder, session, viewers. The replay's own
recording goes to a temporary folder, not to `data/raw`. `npm run load-smoke -w server` runs the
same with many viewers and reports delivery delay and memory.
