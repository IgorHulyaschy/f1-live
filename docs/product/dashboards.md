# Dashboards: how the product works

The whole screen is tiles. A dashboard is a list of tiles plus where each one sits on a
24-column grid, and every part of the screen is a tile: the race title, the replay keys, the
lap strip, timing and charts. The top bar keeps only navigation, the plan and the theme. It
also shows the lap when the dashboard on screen has no Replay tile.

Everything here runs in the browser today. Wherever a server is needed, a mock stands in for
it, with the shape listed under [Backend contract](#backend-contract).

## What ships by default

| Ready-made | For                      | Tiles                                                                                               |
| ---------- | ------------------------ | --------------------------------------------------------------------------------------------------- |
| Live       | Race day on one screen   | Session, Replay, Lap strip, Timing, Focus, Race control                                             |
| Analysis   | Lap charts               | Lap strip, Replay, Story strip, Compare, Chart, Telemetry, True pace, Fastest laps                  |
| Strategy   | Tyres and stops          | Lap strip, Replay, Story strip, Stints, Tyre wear, Pit stops, Undercut ledger, Stop cost, Pit crews |
| Battle     | Your driver's fight      | Lap strip, Replay, Timing, Battle chart, Gaps, Box now                                              |
| Drivers    | Faces and cars           | Session, Replay, Grid, Driver, Positions chart                                                      |
| Race story | What happened, and why   | Session, Replay, Story, Positions chart, Championship, Race control, Conditions                     |
| Pit wall   | A TV or a second monitor | Timing, Focus, Race control, Gap chart, Stints; fit to screen                                       |

Viewers can edit any of them; Reset puts it back as shipped. There are 25 tiles in 5 groups
(Race, Drivers, Timing, Analysis, Strategy). Five of them are Pro: Box now, True pace, Tyre wear,
Undercut ledger and Conditions.

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
6. **Account** (mocked): sign in with a demo account to publish dashboards to the library.
   - Real accounts would sync dashboards across devices.

## Free and Pro

|                            | Free          | Pro        |
| -------------------------- | ------------- | ---------- |
| Ready-made dashboards      | All, editable | All        |
| Dashboards of your own     | 3             | Any number |
| Share links, export/import | Yes           | Yes        |
| Pro tiles                  | Locked teaser | Yes        |
| Publish to the library     | No            | Yes        |

The limit is `FREE_OWN_DASHBOARDS` in `client/src/features/dashboard/use-add-dashboard.ts`.
Until there is billing, the Free/Pro keys in the top bar preview each plan.

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

The mocks live in `client/src/features/library/`, and their types are the payloads.

| Endpoint              | Body / response                    | Mocked by                           |
| --------------------- | ---------------------------------- | ----------------------------------- |
| `GET /me`             | `Account` or 401                   | `accountStore`                      |
| `GET /me/dashboards`  | `Dashboard[]`                      | `dashboard-store.ts` (localStorage) |
| `PUT /me/dashboards`  | `Dashboard[]`                      | same                                |
| `GET /library`        | `LibraryEntry[]`, most added first | `COMMUNITY` + `usePublished`        |
| `POST /library`       | `Dashboard` → `LibraryEntry`       | `publishDashboard`                  |
| `DELETE /library/:id` |                                    | `unpublishDashboard`                |

The server should validate dashboards with the same rules as `parseDashboardText` in
`client/src/features/dashboard/dashboards.ts`:

- unknown tiles and broken placements are dropped;
- names are cut to 40 characters;
- ids are unique.

Share links need no endpoint. A short-link service (`POST /shares` → `/s/:code`) would only
make them shorter.
