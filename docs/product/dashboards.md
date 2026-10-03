# Dashboards: how the product works

The whole screen is tiles. A dashboard is a list of tiles plus where each one sits on a
24-column grid, and every part of the screen is a tile: the race title, the replay keys, the
lap strip, timing and charts. The top bar keeps only navigation, the plan and the theme. Under
it, the live strip says which session is on screen and how it stands, on every page.

Everything here runs in the browser, and keeps working with no account. Signed in, the
dashboards also sync to the account. The fan library is still a mock, with the shape listed under
[Backend contract](#backend-contract).

## The live strip

One line under the top bar, always in view:

- **Live or not.** "Live" lit like an on-air sign while the screen follows a running session;
  "Back to live" after stepping back; "Stale" or "Reconnecting" when the feed stops; "Replay" or
  "Upcoming" otherwise.
- **The session.** The meeting, the session and, in qualifying, the part (Q2, SQ1).
- **The clock.** The time left in the part or session, large, from the feed's own clock
  (`ExtrapolatedClock`, kept as the snapshot's `clockLog`); "Held" while a red flag stops it.
  Races show the lap instead: `Lap 30/50`, printed once on the page.
- **The flag, and who matters.** Track status, then the leader in a race, the fastest lap in
  practice, and in qualifying the cars still to run and the drop zone: who goes out if the part
  ended now.
- **Elsewhere.** On another session while one is live: "Live now" with a one-click Watch live.
  With nothing live: the next session, its start in the viewer's time and a countdown. The
  Sessions key and, while results are hidden, Jump to the finish sit at the end; so do the replay
  keys when the dashboard on screen has no Replay tile. On a live session joined late, From the
  start goes back to the beginning.

On a phone the strip keeps the state, the part, the clock and the flag on one line, and the drop
zone on a second.

## The timeline

The Replay tile is the session's timeline, at the top of every ready-made dashboard:

- **Play, speed and steps.** Previous and next lap (or minute), play and pause, and one key that
  cycles the speed in multiples of real time: 1×, 10×, 60× (the default).
- **Events.** The start (each part's start in qualifying), each flag as it comes out, the lead
  and fastest laps, passes made on track, stops, penalties and cars out, as markers over the
  barcode in their own colours. Hover one for what happened; click it to go there. The event keys
  jump to the previous or next event, filtered: All, Flags, Stops, or Mine (the followed driver).
- **Scrubbing.** The race barcode is the track: click or drag along it to move the replay; the
  line under it says what happened at the lap or minute on screen.
- **Live.** On a running session it also holds the broadcast delay; "Back to live" is on the
  live strip, always in view.
- **Keys.** ← → step, Shift with them jumps between events, Space plays, L goes back to live; the
  footer prints them on desktop.

A short tile (three rows or fewer) keeps the keys and the barcode and leaves out the speed, the
filter and the line under it. While results are hidden, only the events already shown are
marked.

## Spoiler protection

On by default. A finished session the viewer has not revealed opens at its start (qualifying at
the start of Q1, a race at lap 1), paused, with a line offering Play and, apart from it, Jump to
the finish. Nothing outside the replay position gives the result away: the picker and ⌘K say
"Results hidden", the tab title names no result, and the driver views show only what has
happened so far. Watching to the end or Jump to the finish reveals the session; the picker has a
Show key per session. A link with a position (`lap`) opens there. The rule and its helpers, and
how lists of sessions must use them, are in [flows.md](flows.md#spoilers).

## Driver, lap and compare views

A driver anywhere on screen (a timing row, a car on the map or in its list, the grid wall, a
knockout or best-sector row, the focus and battle tiles, a chart legend, a stint bar, race
control) opens their session in a side sheet beside the dashboard, a full page on phones. The
sheet is not modal: the replay keys still work and another driver's row opens theirs.

| View    | Address             | Shows                                                                                                                                                                                                                                                                                                |
| ------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Driver  | `?car=63`           | Position, gap, best lap, tyre, stops; every lap with its sectors, tyre, place, gap and interval, pit, flag, penalty and deleted time; runs and push laps in qualifying; stints; position; best sectors, ideal lap and traps; best-lap telemetry against pole or the teammate; race control and radio |
| Lap     | `?car=63&carLap=26` | The lap's time, sectors, tyre, place and flag; speed, throttle, brake, gear and revs, or the mini-sector table, against any driver's lap (`vs`, `vsLap`)                                                                                                                                             |
| Compare | `?car=63&vs=16`     | Both drivers' standing, best sectors against each other, lap against lap, and their best laps traced                                                                                                                                                                                                 |

Breadcrumbs lead back up: Season and Event open the session picker, Session closes the sheet,
the driver goes back from a lap. Back steps out one level and Close all of them, and either keeps
the replay where it is; a view that came with a link closes onto its session. Clicking a lap
opens it; race-control messages, race chart points and stint rows move the replay there.

Each part of the driver view (laps, runs, stints, position, best sectors, best-lap telemetry,
race control and radio) and the compare view is also a **Driver view** tile. The tile is bound
to a driver, or to whoever the viewer follows, and its header picks either. In the sheet, each
part has **Add to dashboard**, and **Make a dashboard of this view** saves every part as a new
dashboard.

Every tile header reads the same way: the title on the left, its modes on the right, and an
options menu at the end (open the tile in a new window, edit the dashboard). Playback lives in
one place: the Replay tile, or the live strip's clock when the dashboard has no Replay tile.

## Home

`/` is the home page: an ask box, what is live or starts next with Watch live or Catch up, the
championship as it stood before the session on screen, and the latest weekend. A first visit
lands there. A viewer can make any page their start page (the default is home), and `/` then
opens it; a link with a session or position always opens the session.

## Session layouts

`/session` opens the layout for the session on screen, and the first tab is named for it: Race (races
and sprints), Quali (qualifying and sprint qualifying) or Practice. Opening the app while a
session runs lands on it; when a session goes live with nothing in the address, the screen moves
to it and its layout.

| Layout   | For                        | Tiles                                                                                            |
| -------- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| Race     | The order and the strategy | Replay, Timing, Track map, Focus, Race control, Stints                                           |
| Quali    | Who is through, who is out | Timing with the cut lines, Replay, Knockout, Race control, Track map, Best sectors, Gap distance |
| Practice | Pace, race runs and tyres  | Timing, Replay, Long runs, Race control, Track map, Stints                                       |

- **Tiles for another kind of session** are left out of the session layouts. On the viewer's
  own dashboards and the other ready-made ones they shrink to one line saying what they are
  for, such as "Box now, races only"; editing shows them as saved, and nothing is changed.
- **Tabs follow the session.** Next to the session's layout come the ready-made dashboards that
  suit it (Strategy, Battle and Analysis on race day; Analysis in qualifying; Analysis and
  Strategy in practice), then the viewer's own. Every other ready-made dashboard is under More,
  and all of them are in ⌘K and the Library. Number keys follow the same order.
- **The viewer's own dashboards are never replaced.** On one built for another kind of session
  (it holds tiles that mean nothing in this one), a line offers "Switch to the Quali layout", Not
  now, or Don't ask again. The answer is saved on that dashboard (`sessionOffer: false`), so it
  syncs with the account like the rest of it.
- **The track map** sits beside the timing in Race, where it shows without scrolling on a laptop
  (1600 × 1000), and under the timing in Quali and Practice, beside Best sectors or Stints.
  Quali ends with Gap distance: the grid as metres behind pole.

## What ships by default

| Ready-made | For                      | Tiles                                                                           |
| ---------- | ------------------------ | ------------------------------------------------------------------------------- |
| Race       | Race day on one screen   | Replay, Timing, Track map, Focus, Race control, Stints                          |
| Quali      | Qualifying on one screen | Timing, Replay, Knockout, Race control, Track map, Best sectors, Gap distance   |
| Practice   | Practice on one screen   | Timing, Replay, Long runs, Race control, Track map, Stints                      |
| Analysis   | Lap charts               | Replay, Compare, Chart, Telemetry, True pace, Fastest laps                      |
| Strategy   | Tyres and stops          | Replay, Stints, Tyre wear, Pit stops, Undercut ledger, Stop cost, Pit crews     |
| Battle     | Your driver's fight      | Replay, Timing, Battle chart, Gaps, Box now                                     |
| Track      | The race on the circuit  | Replay, the eight Track tiles                                                   |
| Drivers    | Faces and cars           | Session, Replay, Grid, Driver, Positions chart                                  |
| Pit wall   | A TV or a second monitor | Timing, Track map, Gap chart, Focus, Race control; fit to screen                |
| Race story | What happened, and why   | Session, Replay, Story, Positions chart, Championship, Race control, Conditions |

Viewers can edit any of them; Reset puts it back as shipped. Race keeps the id the Live preset
had (`live`), so an edited Live opens as an edited Race. There are 37 tiles in 6 groups (Race,
Drivers, Timing, Track, Analysis, Strategy). Nine of them are Pro: Box now, True pace, Tyre wear,
Undercut ledger, Conditions, Pit rejoin, Dominance, Speed map and Ghost lap.

The three tiles the session layouts added:

- **Knockout** (qualifying): pole, the car on the cut with the time to beat, the followed
  driver's gap to the cut, the drop zone with each car's gap to the cut, whether it is out on
  track or in the garage, and its tyre, then the last improvements with their sectors.
- **Best sectors**: who holds each fastest sector, and every driver's ideal lap from their own
  best sectors, with what their best lap left out there.
- **Long runs** (practice): each driver's longest run of five or more clean laps on one set, its
  average and fall-off per lap, or the laps run on each compound.

The timing tower in qualifying shows the gap to the top of the part by default, a To cut column
while a part runs, the drop zone's places in red, and a mark on each car that moved up in the
last minute.

## Track tiles

Maps of the circuit, from the session's telemetry (`docs/product/telemetry.md`):

| Tile         | Shows                                                                                                  | Plan |
| ------------ | ------------------------------------------------------------------------------------------------------ | ---- |
| Track map    | Every car, the followed one emphasised; whole circuit or follow camera; sector colours; 2025 DRS zones | Free |
| Battle map   | The followed driver and the cars either side: road gaps, pace difference, laps until in range          | Free |
| Flag map     | Yellow and double-yellow marshal sectors with the messages that raised them                            | Free |
| Pit rejoin   | Races: a ghost where the followed car would rejoin if it boxed now, from the measured pit loss         | Pro  |
| Dominance    | The circuit painted by the quickest of two or three drivers in each mini sector                        | Pro  |
| Speed map    | One lap painted by speed, gear, throttle or braking, with top speed and slow corners                   | Pro  |
| Gap distance | Every car on one straight, behind the fastest by the metres its gap is worth; Share is Pro             | Free |
| Ghost lap    | The ten best laps run together from the same line, so the gaps grow and shrink corner by corner        | Pro  |

Where the cars come from, in order: the replay's position chunks; live, the feed's positions
channel; otherwise an estimate from lap and sector times and the timing loops' mini sectors,
labelled "Estimated". The live feed sends positions only with an F1 TV login on the server
(`F1TV_TOKEN`), and a live map says so. The replay clock runs between laps at 1×, 10× or 60×
(the default, about a lap a second and a half); the first lap starts at the start signal.

What is approximate, and says so on screen:

- Marshal sectors are laid out as equal shares of the lap: the feed names them but not where
  they are, so a flag's place is a guess.
- Mini-sector times measured between the timing loops' messages are a tenth or so either way;
  dominance uses car positions where the session has them, and the loops' own purple holders.
- 2026 cars have no DRS; their straight-mode zones are not in the data, so the map shows none.

### Gap distance and ghost lap

Gap distance answers "how far back is that?" for a lap time: each car stands on a straight
behind pole by the distance it still had to run when pole crossed the line. Its keys:

- **Field**: Q1, Q2, Q3 or the session's best laps in qualifying; Race or Best in a race. Race
  turns each car's gap to the leader, at the lap on screen, into distance at the leader's speed
  over its last lap, and moves with the replay and live timing.
- **Cars**: the top ten or the whole field. **Split**: the lap, or who loses where: three
  straights, one a sector, each car behind the quickest through it by the time it lost there.
- **Share** saves the straight as a picture for a feed post (1080 × 1350) or a story (1080 × 1920),
  with the title, the session, the brand and the site, drawn in the browser (Pro).

How a gap becomes metres (`client/src/insights/gap-distance.ts`): the official gap, scaled onto
the car's own telemetry clock, is run backwards from the line on its speed channel. In 2026
Bahrain qualifying Hamilton's 0.298 s behind a 1:35.130 pole comes to 22.1 m: he crossed at 269
km/h, about 75 m a second. Positions jump by several metres between samples, so the speed is
integrated rather than the distance read. A lap without telemetry runs its gap at the car's
speed over the line, or its average speed round the lap, and its label starts with "~".

Ghost lap (Pro) runs the ten best laps of a part, or of the session, from the same line on the
circuit, each from its own telemetry: play, pause, scrub, and the metres between the cars beside
the map. At pole's lap time the picture is the Gap distance straight. Both are components a
driver view can embed (`GapStraight`, `GhostLap` in `client/src/features/gaps/`).

### Qualifying charts

In qualifying the Trace chart reads as qualifying does. Lap times shows push laps only (no out,
in or cool-down laps) on the session clock, with Q1, Q2 and Q3 marked and a line per driver that
steps down at each improvement within a part. Gap gives each driver's best lap in each part
behind that part's fastest, and Positions the order within each part; Battle and Versus stay
race charts.

## Insights

What the analysis tiles show, and what each needs. Each gives its numbers as a table too (its
Table key, or a table to begin with), and works on a phone and a 2560 px screen alike.

| Visual                   | Tile            | Shows                                                                                                               | Sessions                                         |
| ------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Telemetry traces         | Telemetry       | Speed, throttle, brake, gear and revs by distance for up to three laps, the delta, mini sectors, corner speeds      | All; saved sessions with telemetry only          |
| Race trace and lap chart | Chart           | Gap to the leader, positions, the battle and the gap to one driver, with stops and flags marked                     | Races; lap times in every session                |
| Race story ribbon        | Story           | Flags, the lead, passes made on track, stops, penalties, cars out and radio, per lap; click to jump                 | All, by minute on the clock                      |
| Undercut ledger          | Undercut ledger | Each stop exchange: in-lap, stop, out-lap and the net place, adding up                                              | Races                                            |
| Tyre life and crossover  | Tyre wear       | Fuel-corrected loss by tyre age per compound, the cliff, the age a new set of a compound slower when new is quicker | Races; wear only in practice                     |
| Pit stop cost            | Stop cost       | What a stop costs in race time at this circuit, under green and under a VSC                                         | Races                                            |
| Pit crew league          | Pit crews       | Each team's stops at a standstill, ranked by their usual stop                                                       | Races                                            |
| Championship swing       | Championship    | The standings as the race runs, each contender's deficit lap by lap, what every place is worth                      | Races and sprints; live only with an F1 TV login |
| Weather insight          | Conditions      | Head- or tailwind on each straight, track temperature beside the field's pace                                       | All; the wind map needs telemetry                |

Where the data comes from:

- **Telemetry** is read from the saved session's files ([telemetry.md](telemetry.md)); a live
  session has none before its import, and the tile says so. The modelled replay draws a few of the
  real race's laps, from the real-data e2e fixture.
- **Passes, team radio and the championship** come from the archive's `OvertakeSeries`,
  `TeamRadio` and `ChampionshipPrediction`. The live feed sends the championship only with an F1 TV
  login (`F1TV_TOKEN`), and the tile says that while live.
- **Team radio** clips are announced on the story; their audio is Formula 1 media, so a viewer can
  open a clip from the official archive only with `VITE_TEAM_RADIO=link`, off by default.
- **Wind** uses the feed's wind direction with the outline, whose positions put x east and y north.

### Free and Pro per visual (proposal)

A proposal for the owner, on the existing Pro-tile mechanism (`pro` in `TILE_INFO` and `ProGate`):
data a fan expects anywhere stays free, models that turn it into a strategy call are Pro.

| Visual                   | Proposed | Why                                                                                                                               |
| ------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Telemetry traces         | Free     | The core analysis fans compare products on; TracingInsights and GP Tempo give it free ([competitors](../research/competitors.md)) |
| Race trace and lap chart | Free     | An upgrade of the free Chart tile                                                                                                 |
| Race story ribbon        | Free     | Makes replays navigable; it brings viewers back                                                                                   |
| Championship swing       | Free     | High attraction in the last races of a season; the feed's own numbers                                                             |
| Pit stop cost            | Free     | One number per circuit; Box now, which uses the same idea, is already Pro                                                         |
| Pit crew league          | Free     | Low insight, high fun                                                                                                             |
| Undercut ledger          | Pro      | Nobody else explains strategy calls; the reason fans open analysis                                                                |
| Tyre life and crossover  | Pro      | Upgrades Tyre wear, already Pro; it is a pit-window read                                                                          |
| Weather insight          | Pro      | A niche model built on the outline and the wind                                                                                   |

## Flows

1. **First run** (`/welcome`, linked from a banner on the ready-made dashboards):
   - pick the driver you follow, which tints the whole app and is remembered;
   - pick how you watch, which opens the matching ready-made dashboard.
2. **Make it yours**: Edit on any dashboard.
   - Drag a tile by its bar; resize from the edges or with Shift and the arrow keys.
   - Add tile, Remove, or pop a tile out to its own window. Windows stay in sync.
   - Text size goes from S to TV, and Fit stretches the dashboard to the window height.
3. **Start fresh or copy**: + in the bar starts an empty dashboard. Duplicate copies one.
4. **Library** (`/library`):
   - your dashboards;
   - the ready-made ones;
   - fan dashboards to preview live and add a copy of.
5. **Share**: the Share key copies a link that carries the whole dashboard (`/shared?d=…`).
   - The receiver previews it live and adds a copy. No account and no server are needed.
   - Export and Import do the same with a JSON file.
6. **Account** (`/account`, and the account key in the bar; the footer on phones):
   - sign in with an emailed link, or Google and Apple when the server has them;
   - dashboards made here before signing in join the account; from then on every edit syncs, and
     other devices pick it up when they come back to the tab or within half a minute;
   - two devices editing one dashboard: the newer edit wins, and the other device says so;
   - the plan, Go Pro (monthly or yearly), Manage billing, Export my data and Delete account.

## Free and Pro

|                            | Free          | Pro        |
| -------------------------- | ------------- | ---------- |
| Ready-made dashboards      | All, editable | All        |
| Dashboards of your own     | 3             | Any number |
| Share links, export/import | Yes           | Yes        |
| Pro tiles                  | Locked teaser | Yes        |
| Publish to the library     | No            | Yes        |

The split is `PLAN_ENTITLEMENTS` in `shared/src/plans.ts`. The account server enforces it: on
Free, saving a fourth dashboard of your own answers `403 dashboard_limit`, and the app shows the
upgrade prompt. Pro comes from the account's subscription, bought through the payment provider.
The Free/Pro keys in the top bar stay as a preview of Pro tiles for anyone not on Pro; they do not
lift the dashboard limit. Prices live with the payment provider; none are set here.

**Proposal for the owner, Track tiles.** The map is free, as are the battle map and the flag map:
they are what a fan expects to see and the best reason to open the app on race day. The deeper
reads are Pro: pit rejoin (it extends Box now, already Pro), mini-sector dominance and the speed
map (the analysis fans compare paid products on). Each is one `pro` flag in `TILE_INFO`
(`client/src/features/dashboard/dashboards.ts`) to move.

**Proposal for the owner, gap visuals.** Gap distance is free: the straight is the picture fans
share about a qualifying session, and every shared picture brings people to the app. Ghost lap
and Share are Pro: the ghost lap is the deep read (laps run corner by corner from telemetry), and
a polished card at social sizes is a creator's tool. To make Share free, drop the plan check in
`ExportKey` (`client/src/features/gaps/gaps-tile.tsx`); Ghost lap is one `pro` flag.

## Pictures

Driver photos, team logos and cars load straight from formula1.com in the viewer's browser.
They use the references the official timing feed already publishes (`HeadshotUrl` and
`PublicIdRight` in DriverList). No picture is stored in this repository.

Every picture has a drawn fallback:

- the race number on a team-colour plate;
- the team name;
- a generic single-seater outline in the team colour.

So the app reads the same when the pictures are blocked. Set `VITE_F1_MEDIA=off` to always
use the fallbacks.

**Before charging money**: these pictures belong to Formula 1 and the teams. A paid product
needs a media licence, or its own artwork, before showing them.

## Backend contract

The account API is real (`server/src/accounts/routes.ts`, on when the server has a database). A
dashboard is one JSON document with a version; a device sends the version it last saw and when it
made the edit, and the server keeps whichever edit is newer.

| Endpoint                        | Body / response                                                    |
| ------------------------------- | ------------------------------------------------------------------ |
| `/api/auth/*`                   | Better Auth: magic link, Google, Apple, sign-out                   |
| `GET /api/me`                   | The account, its plan and entitlements, or `null`                  |
| `GET /api/me/dashboards`        | `{ documents }`; a deleted dashboard has `dashboard: null`         |
| `PUT /api/me/dashboards/:id`    | `{ dashboard, baseVersion, updatedAt }` → 200, 409 newer, 403      |
| `DELETE /api/me/dashboards/:id` | `{ baseVersion, updatedAt }` → 200 or 409 newer                    |
| `PUT /api/me/viewer`            | Spoiler settings `{ protect, protectUpdatedAt, revealed }`, merged |
| `GET /api/me/export`            | Everything the account holds, as a JSON download                   |
| `DELETE /api/me`                | `{ confirm: email }`; ends the subscription, then deletes it all   |
| `POST /api/billing/checkout`    | `{ interval }` → the provider's checkout `{ url }`                 |
| `POST /api/billing/portal`      | The provider's billing page `{ url }`                              |
| `POST /api/billing/webhook`     | Signed provider events                                             |

The library is still mocked in `client/src/features/library/`, and its types are the payloads.

| Endpoint              | Body / response                    | Mocked by                    |
| --------------------- | ---------------------------------- | ---------------------------- |
| `GET /library`        | `LibraryEntry[]`, most added first | `COMMUNITY` + `usePublished` |
| `POST /library`       | `Dashboard` → `LibraryEntry`       | `publishDashboard`           |
| `DELETE /library/:id` |                                    | `unpublishDashboard`         |

Server and client read dashboards with the same rules, `dashboardSchema` in
`shared/src/dashboard.ts`:

- unknown tiles and broken placements are dropped;
- names are cut to 40 characters;
- ids are unique.

Share links need no endpoint. A short-link service (`POST /shares` → `/s/:code`) would only
make them shorter.
