# Telemetry: positions, car data and the circuit

What the track map, battle map, mini-sector dominance, pit rejoin, flag map, speed and gear on
the circuit, lap delta by distance and telemetry traces read. These are not race events:
`Position.z` and `CarData.z` carry 3 to 4 samples a second for every car, about 7 MB each for a
race. The archive serves them after the session; the live feed sends them only with an F1 TV
token (`F1TV_TOKEN`), and then on the opt-in channels in [live-protocol.md](live-protocol.md).

## Build

```sh
npm run fetch:f1 -w server -- 9858                 # raw archive, once
npm run telemetry -w server -- --key 9858 [--svg out.svg] [--rebuild-outline]
```

The import builds it for you. `npm run import` and `npm run rebuild` call `buildTelemetry` for
every session whose raw files have `Position.z`, after the events and the snapshot; the live
server's end-of-session import does the same, since it runs the same import on the recording.
`--no-telemetry` skips it and leaves what is on disk. A session without `Position.z`, a circuit
key or a completed lap is reported as skipped, and the folder an earlier build left for it is
removed; one that fails to build is listed in the report, loses its old folder too, and does not fail the import. The
catalog says per session whether it has telemetry: `outputs.telemetry`.

From code:

```ts
import { buildTelemetry } from './telemetry/build.js';

await buildTelemetry({ rawDir, key, dataDir }); // rawDir: the session's raw folder
```

The outputs are deterministic: the same raw files give the same bytes, so a rebuild from raw
hashes the same as the import did. A circuit's outline is drawn from the first session of it that
is built, then saved and read back, and every later session measures its laps against that saved
outline. A rebuild removes all telemetry and saved outlines first and goes in path order, so the oldest session of a circuit
draws it.

It is idempotent and rebuilds from raw only. The whole 2025 Las Vegas race takes about 4.5 s.
Results: [docs/research/telemetry-las-vegas.md](../research/telemetry-las-vegas.md).

## Output

Under `<DATA_DIR>/out/telemetry/`, served at `/telemetry/…` with the other saved data:

| File                                | What                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `circuits/<circuitKey>.json`        | The circuit outline. Built once, reused by later sessions of the circuit.  |
| `<key>/index.json`                  | Start here: circuit, `hasCarData`, where the next two files are.           |
| `<key>/laps.json.gz`                | `LapIndex`: one entry per driver and lap, with its file, size and flags.   |
| `<key>/laps/<driver>-<lap>.json.gz` | `LapTelemetry`: one lap as columns.                                        |
| `<key>/replay/index.json`           | `ReplayManifest`: origin time, step, chunk list.                           |
| `<key>/replay/<n>.json.gz`          | `ReplayChunk`: a minute of every car at 4 Hz, readable without the others. |

All types are in `shared/src/telemetry.ts`, with the pure helpers:

- `pointOnTrack(outline, distanceM)`: place and heading at a distance along the lap.
- `projectToTrack(outline, x, y, hintM?)`: distance along the lap of a position.
- `miniSectorAt` / `miniSectorOfPoint` / `sectorAt`: which mini sector or sector.
- `alignLaps(a, b, stepM)`: time of `b` minus time of `a` at every distance (delta by distance);
  `timeAtDistance` for one distance.
- `expandReplayCar(car, quantM)`: a chunk's deltas back to metres.

### Outline

Metres in the feed's own frame (position X and Y are tenths of a metre in the feed), so cars and
outline draw together. `points` is a closed loop in driving direction, `points[0]` on the
start/finish line, evenly spaced (about 5 m) so distance `d` is at index `d / step`.
`rotationDeg` is the turn that puts the long side horizontal; the data itself is not rotated.
`miniSectorStartsM` has one entry per mini sector, and `miniSectorsPerSector` matches the
segment counts of `TimingData` (6, 7 and 9 at Las Vegas). `pitLane` is the lane as a polyline
with where it starts and ends along the lap. Corner numbers are not given: the feed does not
publish them and they cannot be derived reliably from positions alone.

How it is made: the quickest green lap of the session that did not touch the pits is smoothed
(centripetal spline, moving average) and closed. The line is where cars were when the feed
published a lap, once the feed's delay (found by making those places agree) is taken off. Sector
ends are where cars were when the official sector times had run. Mini-sector boundaries are
where cars were when the feed gave each segment a colour, with the same delay.

### Laps

Rows are on a fixed 250 ms grid from the line crossing, plus a last row at the end of the lap.
`d` is metres along the lap, from projecting the position on the outline, and never decreases.
Position and car data are sampled at different instants, so each channel is read between its
samples (gear, brake and DRS from the nearest). Throttle and brake of 104 (the feed's "no
reading") are 0. `drs` is absent where the feed has no DRS channel.

Flags in the index: `partial` for lap 1 of a standing start (the car begins behind the line);
`pitIn` / `pitOut` for laps that end or begin in the pit lane. Their distance is measured to the
pit lane's own timing line, which sits about 140 m before the line at Las Vegas, so they differ
from the circuit length by up to 2.3%. Other laps are within 0.01%, since each lap runs from one
crossing of the line to the next. Compare laps for delta by distance only when neither is
`pitIn`, `pitOut` or `partial`.

### Replay

Positions every 250 ms in whole metres. A chunk is 60 s: for each car, `x` and `y` hold the first
place in metres, then each change. Sample `i` of chunk `c` is at `originAt + t0 + i * stepMs`.
`off` lists sample ranges where the feed says the car is off the track. Between samples a client
should interpolate; before a car's first sample and after its last it is held in place.

## In the app

The Telemetry tile reads `index.json`, the lap index and the circuit when a session opens, then
each lap file it draws, once per page (`client/src/data/telemetry-source.ts`). It compares only
laps that ran line to line (not `partial`, `pitIn` or `pitOut`, and within 1% of the circuit
length, since the index does not flag every trip to the garage), and only laps done by the moment
on screen. The Conditions tile uses the outline to find the straights for the wind.

Gap distance (`client/src/insights/gap-distance.ts`) turns a lap-time gap into metres by
running it backwards from the line on the car's own speed channel, after scaling the official
gap onto the telemetry clock: telemetry lap times run a few tens of milliseconds off the
official ones, and positions jump by metres between samples where the speed does not.

## Accuracy

- The outline is a racing line, a little shorter than the middle of the track: 6145 m against the
  official 6201 m at Las Vegas (-0.9%).
- The line's place and the mini-sector boundaries depend on the feed's delay, which cannot be
  measured better than about 0.1 to 0.2 s: 10 to 25 m at full speed.
- Position data are 4 Hz and about 1 m noise; speed peaks and braking points are smoothed by that.

## Live

`LiveTelemetry` (`server/src/telemetry/live.ts`) turns `Position.z` and `CarData.z` frames into
the throttled `positions` and `car_data` messages. An `ingest` server sends them on to the relay
(`POST /ingest/channels`), which gives them to the viewers that subscribed. Without a token neither arrives, and a viewer
sees `live: false` in the `channels` answer.

## Mini sectors in the snapshot

The timing loops' `TimingData` segments are race events too: the decoder sends a `mini_sector`
event each time a car leaves a mini sector, with the loop's mark (the session's fastest, the
driver's best, neither, or the pit lane). The snapshot keeps, per car, the lap in progress, the
lap before and the best pass through each mini sector (`miniSectors`), and who holds the
session's fastest time in each (`miniSectorLeaders`). Like the running order they are as of
now, so a cut of the session drops them. Times between the feed's messages are a tenth or so
either way; positions, where a session has them, are better. A race adds about 20 000 of these
events, as many as everything else together.

## In the client

`client/src/features/track` reads it all:

- `use-track.ts` loads the session's `index.json`, the circuit (from the index, or live from
  `session.circuitKey`, which the decoder now sets) and the replay manifest, once per page; a
  manifest that failed is asked for again by the next map that opens.
- `replay-positions.ts` expands chunks into metres and samples every car at any moment, on a
  Catmull-Rom curve through the 250 ms samples, so cars glide at any frame rate. Chunks load
  around the moment drawn and a few ahead while playing.
- `live-positions.ts` buffers the `positions` channel (`docs/product/live-protocol.md`) and
  draws a second behind the newest frame, and behind the broadcast delay.
- `estimate.ts` places cars from timing alone when there are no positions: a known lap is driven
  at the pace of its sectors, with the pit lane at the end of an in-lap and the start of an
  out-lap; a lap in progress runs on from the last mini sector at the pace the car did it last
  time, and never past the next loop; before a race starts the cars are on the grid.
- `client/src/insights/pit-window.ts` measures the circuit's pit loss on the session's green-flag stops so
  far (in-lap and out-lap against the laps around them), for Box now, the tower's ghost row and
  the pit rejoin map; before anyone stops it assumes a typical 22.9 s.
- `dominance.ts` times each mini sector on a lap from its telemetry, at `miniSectorStartsM`.
- `drs-zones.ts` finds 2025 DRS zones where cars within a second of the one ahead opened the flap.

The e2e fixture keeps only what its tests open (`client/e2e/real/derive-telemetry.ts`).
