# Dashboards: how the product works

The whole screen is tiles. A dashboard is a list of tiles plus where each one sits on a
24-column grid, and every part of the screen is a tile: the race title, the replay keys, the
lap strip, timing and charts. Over them sits one slim bar, 48 px from a laptop up: home, the
dashboards, the session on screen, Ask, and one menu for everything used now and then.

Everything here runs in the browser, and keeps working with no account. Signed in, the
dashboards also sync to the account, and the fan library and alerts live in the accounts database
([Backend contract](#backend-contract)).

## The bar

One line over every page, always in view. The session's parts (live or not, the session, the
clock, the flag and the keys) show only where a session is on screen: a dashboard or a
dashboard's preview. The home, the season pages, the library list, alerts and the account show
none, and neither does a phone's pit board.

- **Home and the dashboards.** Tabs from a laptop up, with the ready-made dashboards the session
  does not need under More; below a laptop, one key named after the dashboard on screen opens
  the same list.
- **Live or not.** "Replay" or "Upcoming" when the session is not running; "Stale" or
  "Reconnecting" when a live feed stops. A running session's live key sits with the transport
  (see The timeline), or in the bar's own clock when the dashboard has no Replay tile.
- **The session.** The Sessions key opens the picker and names the meeting and the session on a
  wide screen; in qualifying the part (Q2, SQ1) follows it.
- **The clock.** The time left in the part or session, from the feed's own clock
  (`ExtrapolatedClock`, kept as the snapshot's `clockLog`); "Held" while a red flag stops it.
  Races show the lap instead: `30/50`. On a dashboard with no Replay tile the replay keys sit
  here too.
- **The flag.** Green says nothing. Yellow, VSC, safety car and red light the bar's lower edge in
  the flag's colour and print the flag beside the clock.
- **Elsewhere.** On another session while one is live, a Watch live key. While results are
  hidden, Jump to the finish; on a live session joined late, From the start.
- **Ask and the menu.** Ask opens ⌘K. The menu holds the dashboard on screen (Edit, Add tile,
  Copy share link, Open in a new window, Duplicate, Export, Import, Reset or Delete), New
  dashboard, the Library, the season pages, the theme, Larger text, Preview Pro and the account.

The leader, the fastest lap, the cars to run, the drop zone and the next session are tiles' jobs
(Timing, Knockout, the home page), so the bar does not repeat them. A phone keeps the same bar,
with the session, Ask and the menu as icons; Replay is left unsaid there, so the finish key fits.

## Screens

A dashboard is exactly one screen on a tablet-wide window and up: the page never scrolls. The
grid's 21 rows stretch to end at the bottom of the window, from a 1280 × 720 laptop to a
3440 × 1440 ultrawide, and what does not fit is on another tab, never below the fold. Only
phones (under 1024 px) stack the tiles and scroll. A table that is longer than its tile scrolls
inside the tile, and a tile with no room left collapses to its header. Text and spacing grow with the screen past 1080 px tall
(19 px on a 1440 px tall screen), so a big monitor is not a sea of small type. **Larger text**
in the menu adds a quarter on top, for a TV across the room, which a window cannot tell from a
monitor; it is the one size switch.

| Screen class | When                                                               | Tiles                                                                         |
| ------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Phone        | Under 1024 px wide (64 rem)                                        | One column in reading order, Replay first (Analysis: chart after the answers) |
| Standard     | Laptop and desktop                                                 | The dashboard's 24-column arrangement                                         |
| Ultrawide    | 1600 px wide or more, and at least 2.2 times as wide as it is tall | The dashboard's ultrawide arrangement, or the standard one                    |

Each ready-made dashboard has both arrangements; the ultrawide one sets the tiles in four
columns instead of two. An edit is saved for the screen class it was made on: moving a tile on
an ultrawide keeps the laptop's arrangement, and reordering the phone stack keeps both grids.
Adding or removing a tile changes all three.

## The timeline

The Replay tile is the session's timeline, on the Race, Quali and Practice layouts; the other
ready-made dashboards leave playback to the bar's keys:

- **Play, speed and steps.** Previous and next lap (or minute), play and pause, and one key that
  cycles the speed in multiples of real time: 1×, 10×, 60× (the default).
- **Events.** The start (each part's start in qualifying), each flag as it comes out, the lead
  and fastest laps, passes made on track, stops, penalties and cars out, as markers over the
  barcode in their own colours. Hover one for what happened; click it to go there. The event keys
  jump to the previous or next event, filtered: All, Flags, Stops, or Mine (the followed driver).
- **Scrubbing.** The race barcode is the track: click or drag anywhere along it to move the
  replay. A playhead (a line with a handle and its lap) shows where it is; hovering shows a ghost
  line with the lap under the pointer and what is marked there. Played laps are dark, laps to
  come are light. The line under it says what happened at the lap or minute on screen.
- **Legend and hint.** A legend under the barcode, in readable text, says what height, colour
  (a pit stop is a blue bar) and each block mean; the MINE filter says on hover that it shows
  only the followed driver's events. The keys are printed on hover. The first time a viewer opens a session, a hint says "Drag
  or click to move through the race, Space plays"; it goes away after the first use and is not
  shown again.
- **Live.** On a running session the live key sits right after previous, play and next, one
  size in every state: "Live" lit like an on-air sign while the screen follows the session,
  "Go live" after stepping back or pausing, unlit and dashed while the feed is down.
  Nothing around it moves when the viewer leaves live or returns. Following live counts as
  playing: pause holds the lap on screen, and play from the newest lap goes back to live. The
  tile also holds the broadcast delay.
- **Keys.** ← → step, Shift with them jumps between events, Space plays or pauses (live too), L
  goes back to live, F goes full screen, B shows or hides the bar in full screen; they are
  printed on hover over the timeline and in the menu's About block.

### Full screen

The bar's full-screen key (or F) gives the tiles the whole window: the browser goes full screen
where it can (an iPhone gets the bare page), the bar hides and the tiles grow into its place.
The pointer at the top edge slides the bar back, and it hides again when the pointer leaves it.
Without a pointer, B shows or hides it. Esc leaves (the browser takes it in real full screen).
The live key and the controls stay where they are in both states.

### Resizing and collapsing tiles

Every tile resizes by its edge or by a grip on its bottom right corner, with no edit mode; the
grip and a collapse key in the tile header show on hover and with keyboard focus (always on touch).
The tile's content adapts to its width. The collapse key and the tile menu's Collapse fold it to
its header (and Expand); the menu also says "Resize a tile by dragging its bottom right corner".
Sizes and collapsed tiles are saved with the dashboard on that screen class.

Lists in tiles show whole rows only: the row count fits the tile's height and the rest scrolls
inside it. Every other tile body ends above the first row or line of text it would cut, so a
footnote shows only where it fits, and no tile overlaps another. `e2e/tile-layout.spec.ts` checks
this on every tab at four screen sizes.

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
one place: the Replay tile, or the bar when the dashboard has no Replay tile.

## Home

`/` is the home page: an ask box, what is live or starts next with Watch live or Catch up, the
season's standings after its latest round the viewer may see, and the latest weekend. Recent
rounds held back as unseen are counted in a note with one key that shows them. Without the
season's results, the open session's own table stands in. A first visit lands there. A viewer
can make any page their start page (the default is home), and `/` then opens it; a link with a
session or position always opens the session.

## Session layouts

`/session` opens the layout for the session on screen, and the first tab is named for it: Race (races
and sprints), Quali (qualifying and sprint qualifying) or Practice. Opening the app while a
session runs lands on it; when a session goes live with nothing in the address, the screen moves
to it and its layout.

| Layout   | For                        | Tiles                                                                                                   |
| -------- | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| Race     | Who is racing whom         | Track map (the largest tile, fights marked on it), a compact Timing tower, Fights, Replay, Race control |
| Quali    | Who is through, who is out | Replay, Timing with the cut lines, Knockout, Track map, Best sectors, Gap distance                      |
| Practice | Pace, race runs and tyres  | Replay, Timing, Long runs, Track map, Stints, Race control                                              |

- **Tiles for another kind of session** are left out of the session layouts. On the viewer's
  own dashboards and the other ready-made ones they shrink to one line saying what they are
  for, such as "Box now, races only"; editing shows them as saved, and nothing is changed.
- **Tabs follow the session.** Next to the session's layout come the ready-made dashboards that
  suit it (Strategy: Stints and Pit stops; Battle: Duel, Race pace, Pace now, Focus, Battle chart, Gaps and
  Box now; Analysis on race day; Analysis in qualifying; Analysis and
  Strategy in practice), then the viewer's own. Every other ready-made dashboard is under More,
  and all of them are in ⌘K and the Library. Number keys follow the same order.
- **The viewer's own dashboards are never replaced.** On one built for another kind of session
  (it holds tiles that mean nothing in this one), a line offers "Switch to the Quali layout", Not
  now, or Don't ask again. The answer is saved on that dashboard (`sessionOffer: false`), so it
  syncs with the account like the rest of it.
- **Timing runs the full height** on the left of Quali and Practice, with the tile that answers
  the session's question beside it. Race is map-first: the track map is the largest tile with the
  cars in a fight marked on it, the tower beside it is compact (position, driver, gap, tyre) and
  opens to the full table with one key or when the tile is wide, Fights and Race control sit
  to the right, and Replay is at the bottom. A phone stacks Replay, Fights, Timing and the map.
- **Each Race tile leads with a headline in words** before its numbers: "VER leads NOR by 3.2 s"
  on Timing, "NOR is 0.4 s behind PIA" on Fights, the latest message on Race control, and
  "HAM ran the longest stint so far, 43 laps on mediums" on Stints.

### Where the eyes go

A dashboard is mostly a second screen next to the TV, read in a glance of one or two seconds. Each
ready-made one answers one question first, at the top left or top centre; dense screens are read
in an F from there along the first row. Colour, size and motion go only to what changed:
the flag (the bar's band), a stop, a fastest lap, the followed driver. Controls (Replay, Compare)
sit at the bottom or the right edge, never between the viewer and the data; the bar holds the rest.

| Layout     | First                     | Second                     | Third                       |
| ---------- | ------------------------- | -------------------------- | --------------------------- |
| Race       | Track map: where it is on | Fights: who is racing whom | Timing: the order           |
| Quali      | Timing with the cut lines | Knockout: who is out       | Best sectors                |
| Practice   | Timing: who is quickest   | Long runs: race pace       | Stints: tyres               |
| Analysis   | Race pace                 | Lap chart                  | Fastest laps                |
| Strategy   | Stints: tyres and age     | Undercut: will it work     | Pit stops: who just came in |
| Battle     | Battle chart: the gap     | Gaps                       | Box now                     |
| Track      | Track map                 | Battle map                 | Pit rejoin                  |
| Drivers    | Grid                      | Driver                     | Positions chart             |
| Pit wall   | Timing                    | Focus                      | Track map                   |
| Race story | Story ribbon              | Positions chart            | Championship                |

Type and spacing come from the screen: a phone at arm's length, a laptop and a TV at three metres
get the same layout scaled by the screen's size, and Larger text is the one switch on top.

The **Season standings** tile (Analysis, add it from the library) lists the top ten of the open
session's season after the latest round the viewer has seen; it links to `/standings`.

## What ships by default

| Ready-made | For                      | Tiles                                                                                                               |
| ---------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Race       | Race day on one screen   | Track map, Timing, Fights, Replay, Race control (Duel, Race pace, Pace now and Focus on Battle, Stints on Strategy) |
| Quali      | Qualifying on one screen | Replay, Timing, Knockout, Track map, Best sectors, Gap distance                                                     |
| Practice   | Practice on one screen   | Replay, Timing, Long runs, Track map, Stints, Race control                                                          |
| Analysis   | Lap charts               | Compare, Chart, Race pace, Fastest laps, Telemetry                                                                  |
| Strategy   | Tyres and stops          | Stints, Tyre wear, Undercut ledger, Pit stops, Stop cost, Pit crews                                                 |
| Battle     | Your driver's fight      | Timing, Battle chart, Gaps, Box now                                                                                 |
| Track      | The race on the circuit  | The eight Track tiles                                                                                               |
| Drivers    | Faces and cars           | Grid, Driver, Positions chart                                                                                       |
| Pit wall   | A TV or a second monitor | Timing, Track map, Gap chart, Focus, Race control                                                                   |
| Race story | What happened, and why   | Story, Positions chart, Championship, Race control, Conditions                                                      |

Viewers can edit any of them; Reset puts it back as shipped. Race keeps the id the Live preset
had (`live`), so an edited Live opens as an edited Race. There are 41 tiles in 6 groups (Race,
Drivers, Timing, Track, Analysis, Strategy). Nine of them are Pro: Box now, Race pace, Tyre wear,
Undercut ledger, Conditions, Pit rejoin, Dominance, Speed map and Ghost lap.

The three race watching tiles, on Race and in the library under Timing. They answer the
questions a lap-time chart makes a viewer work out: who is racing whom, who is fast, and which of
two drivers is quicker. Every number comes from the laps up to the replay's lap, so a replay shows
nothing past it.

- **Fights**: every pair within a second now, then every car closing on the one ahead within ten
  laps, soonest first. A row shows both cars' pictures and team colours, the gap now, a bar from
  the gap to the one-second line with an arrow for how fast it closes, "In DRS" ("In OVT",
  overtake mode, from 2026) or "Within 1 s in 3 to 5 laps", and why the car behind is faster
  ("Stopped 4 laps ago", "Soft against hard", "Tyres 12 laps newer"). Pace comes from the laps
  both cars drove clean since either stopped, so pit, SC and VSC laps never count; under a Safety
  Car, a VSC or a red flag the tile says so ("No fights under the Virtual Safety Car"). Pointing at a row marks the pair on the map and in
  the tower; picking it puts them in the Duel.
- **Pace now**: the whole field as seconds a lap off the fastest car over each driver's last five
  clean laps, with the trend (quicker or slower each lap), the compound and the tyre's age. The
  tower's Pace now column shows the same number per row. Under a flag its header says "paused",
  and an empty tile says which flag paused it.
- **Duel**: any two drivers. It opens on the closest fight that has clean laps to compare (a car
  that just stopped has none); a fight row, the duel's own pickers or Shift and two tower rows pick
  another pair, kept in the address (`duel=PIA,LEC`). Over the last 20 laps, bars above and below
  the line show who was faster on each lap and by how much, a line shows the gap between them,
  stops and flag laps are marked, and one line says it: "LEC is 0.28 s a lap faster over the last
  5 laps and 0.2 s behind: in DRS range now." Without laps together it compares each driver's own
  last clean laps ("HAM is 0.58 s a lap faster over their own last clean laps"), and under a flag
  it says pace is paused.

The tower and the bar's timeline move with the race: rows slide when the order changes, a pass
and a fastest lap flash the row (purple for the fastest), gaps tick to their new value, and the
timeline's line says what just happened ("ALO passes COL and TSU"). With reduced motion, nothing
slides or flashes; the numbers just change.

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

| Visual                   | Tile            | Shows                                                                                                                                                                                                                                                                                   | Sessions                                         |
| ------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Telemetry traces         | Telemetry       | Speed, throttle, brake, gear and revs by distance for up to three laps, the delta, mini sectors, corner speeds                                                                                                                                                                          | All; saved sessions with telemetry only          |
| Race trace and lap chart | Chart           | Lap times as seconds off the quickest car on each lap, the gap to the leader, positions, the battle with the car ahead named, and the gap to one driver; names at the line ends, others greyed behind the followed driver and the duel's pair, outliers clipped, stops and flags marked | Races; lap times in every session                |
| Fights                   | Fights          | Pairs within a second and cars closing, with the laps to catch and the reason                                                                                                                                                                                                           | Races and sprints                                |
| Pace now                 | Pace now        | Seconds a lap off the fastest car over the last clean laps, the trend, compound and tyre age                                                                                                                                                                                            | Races and sprints                                |
| Two-driver duel          | Duel            | Per-lap pace difference as bars, the gap line and a one-line verdict                                                                                                                                                                                                                    | Races and sprints                                |
| Race story ribbon        | Story           | Flags, the lead, passes made on track, stops, penalties, cars out and radio, per lap; click to jump                                                                                                                                                                                     | All, by minute on the clock                      |
| Undercut ledger          | Undercut ledger | Each stop exchange: in-lap, stop, out-lap and the net place, adding up                                                                                                                                                                                                                  | Races                                            |
| Tyre life and crossover  | Tyre wear       | Fuel-corrected loss by tyre age per compound, the cliff, the age a new set of a compound slower when new is quicker                                                                                                                                                                     | Races; wear only in practice                     |
| Pit stop cost            | Stop cost       | What a stop costs in race time at this circuit, under green and under a VSC                                                                                                                                                                                                             | Races                                            |
| Pit crew league          | Pit crews       | Each team's stops at a standstill, ranked by their usual stop                                                                                                                                                                                                                           | Races                                            |
| Championship swing       | Championship    | The standings as the race runs, each contender's deficit lap by lap, what every place is worth                                                                                                                                                                                          | Races and sprints; live only with an F1 TV login |
| Weather insight          | Conditions      | Head- or tailwind on each straight, track temperature beside the field's pace                                                                                                                                                                                                           | All; the wind map needs telemetry                |

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
   - Add tile is in the menu, and in the bar while editing.
3. **Start fresh or copy**: New dashboard in the menu starts an empty one. Duplicate copies one.
4. **Library** (`/library`):
   - your dashboards, with Publish, Update and Unpublish;
   - the ready-made ones;
   - fan dashboards to search (name, tag or @handle), filter by tag, order by most added or newest,
     preview live, add a copy of and report. Its starting entries are examples, marked as such.
5. **Share**: Copy share link in the menu copies a link that carries the whole dashboard (`/shared?d=…`).
   - The receiver previews it live and adds a copy. No account and no server are needed.
   - Export and Import do the same with a JSON file.
6. **Account** (`/account`, and the end of the bar's menu):
   - sign in with an emailed link, or Google and Apple when the server has them;
   - dashboards made here before signing in join the account; from then on every edit syncs, and
     the account's other open devices pick it up at once (a WebSocket nudge, then a pull); a device
     that missed it catches up when the tab comes back, or within half a minute without the socket;
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
Preview Pro in the bar's menu stays as a preview of Pro tiles for anyone not on Pro; they do not
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

A signed-in device also opens `WS /api/me/events?device=<id>`: the cookie rides on the upgrade, and
the socket's Origin must be in `CORS_ORIGINS`. After any accepted dashboard or spoiler-settings
write the server sends `{ type: "changed", topic: "dashboards" | "viewer" }` to the account's other
devices (the one that wrote names itself with the `x-pitwall-device` header and is skipped). The
message carries no data: the device pulls over REST, which stays the source of truth.

### Library, alerts and push

| Endpoint                       | Body / response                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `GET /api/library`             | `?q&tag&sort=popular\|new&page` → `{ entries, hasMore, tags }`, public          |
| `GET /api/library/:id`         | `{ entry }`; a held-back entry shows to its author only                         |
| `GET /api/me/library`          | What the viewer published, held-back entries included                           |
| `POST /api/library`            | `{ dashboard, description, tags }` → 201 or 200 (republish); Pro, a handle      |
| `DELETE /api/library/:id`      | Unpublish; 404 for anyone but the author                                        |
| `POST /api/library/:id/add`    | Counts the viewer's add once; never the author's own                            |
| `POST /api/library/:id/report` | `{ reason }`; enough different reporters hold the entry back                    |
| `GET /api/me/handle`, `PUT`    | The handle; chosen once (`handle_taken`, `handle_reserved`, `handle_profanity`) |
| `GET /api/me/handle/check`     | `?handle` → `available`, `taken`, `format`, `reserved` or `profanity`           |
| `GET`, `PUT /api/me/alerts`    | Alert settings (`shared/src/alerts.ts`) and the registered devices              |
| `POST`, `DELETE /api/me/push`  | Registers or removes a browser's Web Push subscription (ten at most)            |
| `POST /api/me/push/test`       | Sends a test notice to the account's devices                                    |

The library keeps a copy of the dashboard as published; the author's later edits change nothing
until they publish again. The starting entries (`example-*`) have no author. Entries and handles
go with the account; the export lists them. Moderation is configuration, the owner's policy with
these defaults: `LIBRARY_RESERVED_HANDLES` and `LIBRARY_BLOCKED_WORDS` extend the built-in lists,
`LIBRARY_REPORTS_TO_HIDE` (3) and `LIBRARY_MAX_PUBLISHED` (25).

Alerts are one set of rules, `diffAlerts` in `shared/src/alerts.ts`, which compares the session
before and after some events. The app toasts from the snapshot it shows, top right under the bar on a wide screen and above the
pit board on a phone, never over the transport or the scrubber; the server
(`server/src/accounts/alerts/dispatcher.ts`) runs it on the live session after every batch and
sends Web Push to the devices of accounts that want the alert, about the driver they follow (flags
and session starts go to everyone). It holds back a push that is off, about someone else, inside
quiet hours (counted after the account's delay), or that would give a finished session's result
away (a retirement or penalty once the session is final, while protection is on and the session
unrevealed: `spoilsResult`, which asks the same `resultsHidden` as the screens). Subscriptions
live in `accounts.push_subscription`; a 404 or 410 from the push service removes one. The
service worker side is `client/src/platform/push-worker.ts`, called from the shell worker.

`VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` sign the pushes (`npm run vapid -w server`); development
makes a pair of its own beside the database, production leaves push off until they are set.
`VAPID_SUBJECT` (a `mailto:` address or https URL) is the sender identity the push services see:
the owner's to choose. A subscription's endpoint must be a browser vendor's push service
(`isPushEndpointAllowed`; `PUSH_ENDPOINT_HOSTS` adds a host), so no account can point the server at
an address of its own choosing.

Server and client read dashboards with the same rules, `dashboardSchema` in
`shared/src/dashboard.ts`:

- unknown tiles and broken placements are dropped;
- names are cut to 40 characters;
- ids are unique.

Share links need no endpoint. A short-link service (`POST /shares` → `/s/:code`) would only
make them shorter.
