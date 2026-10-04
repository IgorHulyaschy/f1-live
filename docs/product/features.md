# What the product does

The feature list in one place. Pictures of each area are in the [tour](../tour/README.md); how people move through it is in [flows](flows.md); the contract is in [dashboards](dashboards.md).

## History

Seasons from 2018 on: a calendar with `.ics` export, standings after any round, driver pages and a
head to head for any two drivers or teams. See [history](history.md)(history.md).

## Dashboards

The whole screen is tiles on a 24-column grid, from a phone to a wall monitor: the race title,
replay keys and lap strip move and resize like timing or a chart.

- **A home.** `/` asks a question, shows what is live or next, the championship and the latest
  weekend; a returning viewer's start page is kept.
- **Session-aware.** `/session` opens the layout for the session on screen: Race, Quali or Practice,
  named in the first tab. One slim bar says on every page whether a session is live, which part,
  the time left or the lap, and the flag; everything else sits in one menu.
- **One timeline.** The Replay tile plays at 1×, 10× and 60× real time, jumps between events
  (flags, stops, your driver's moments) with Shift and the arrows, and scrubs along the race
  barcode. Track maps move smoothly between laps.
- **No spoilers.** A finished session you have not seen opens at its start, paused, with Play
  and a separate Jump to the finish; nothing else on screen gives the result away. Watching to
  the end reveals it, on every device you are signed in on. Live stays live.
- **Drill down.** Click a driver anywhere (timing, the map, charts, knockout, race control) for
  their session in a side sheet: every lap with its sectors, tyres, gaps and rulings, qualifying
  runs, stints, best sectors and telemetry. Click a lap for its traces against anyone's lap, or
  compare two drivers. Each view has its own address; Back and Escape close it.
- **Ready-made.** The three session layouts, Analysis and Strategy (at `/analysis`,
  `/strategy`), Battle, Track, Drivers, Race story and Pit wall; the ones a session does not need
  wait under More. Edit any of them and Reset brings it back; New dashboard starts your own.
- **41 tiles in 6 groups.** Race (session, replay, lap strip, story, weather, race control),
  Drivers (focus, driver, grid, driver view), Timing (with knockout, best sectors, fights, pace now
  and the two-driver duel), Track (track map,
  battle map, pit rejoin, mini-sector dominance, flag map, speed map, gap distance, ghost lap),
  Analysis (charts, telemetry traces, long runs, championship, conditions) and Strategy (stints,
  tyre wear, stops, undercut ledger, stop cost, pit crews). Tiles for another kind of session
  shrink to one line.
  Drag by the bar, resize from the edges, or use the keyboard: focus a grip, arrows move, Shift
  and arrows resize. Edit mode bars sit in
  the gaps, so a dashboard looks the same while you build it.
- **Maps.** Every car on the circuit, smooth at the display's refresh rate: from the replay's
  car positions, the live feed's positions channel, or estimated from timing when there are
  none.
- **Gaps as distance.** Qualifying or the race on one straight, each car behind by the metres
  its gap is worth; the best laps run together as a ghost lap; and a picture of it at social
  sizes to share.
- **Any monitor.** Tiles fill the window from a laptop to an ultrawide, which gets its own
  arrangement; text grows with the screen, Larger text is there for a TV, and narrow screens
  stack tiles. Panels lay out by their tile's width (container queries).
- **Windows.** Pop out a tile or a dashboard; lap, driver, plan, compared drivers and play/pause
  stay in sync.
- **Library and sharing.** `/library` has your dashboards, the ready-made ones and fan
  dashboards to search, preview, add and report. Pro publishes under a handle chosen once
  (reserved names and profanity refused). The library starts with example dashboards, marked as
  such. **Share** copies a link that carries the whole dashboard; no
  server needed. Export/Import does the same with a file.
- **First run.** `/welcome` picks the driver you follow and a starting dashboard.
- **Free and Pro.** Free keeps 3 dashboards of your own; Pro keeps any number, unlocks Pro tiles
  and publishing. Accounts are real: an emailed sign-in link (Google and Apple when set up),
  dashboards synced across devices, Pro through Stripe or a fake provider in development, and
  an account page to export or delete everything. The fan library is still mocked.
- **Pictures.** Driver photos, team logos and cars load from formula1.com in the viewer's browser,
  using the references the timing feed publishes; nothing is stored in the repo, and each has a
  drawn fallback. A paid launch needs a media licence first.
