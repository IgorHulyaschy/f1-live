# Dashboards: how the product works

The whole screen is tiles. A dashboard is a list of tiles plus where each one sits on a
24-column grid, and every part of the screen is a tile: the race title, the replay keys, the
lap strip, timing and charts. The top bar keeps only navigation, the plan and the theme. It
also shows the lap when the dashboard on screen has no Replay tile.

Everything here runs in the browser today. Wherever a server is needed, a mock stands in for
it, with the shape listed under [Backend contract](#backend-contract).

## What ships by default

| Ready-made | For                      | Tiles                                                            |
| ---------- | ------------------------ | ---------------------------------------------------------------- |
| Live       | Race day on one screen   | Session, Replay, Lap strip, Timing, Focus, Race control          |
| Analysis   | Lap charts               | Lap strip, Replay, Compare, Chart, True pace, Fastest laps       |
| Strategy   | Tyres and stops          | Lap strip, Replay, Stints, Tyre wear, Pit stops                  |
| Battle     | Your driver's fight      | Lap strip, Replay, Timing, Battle chart, Gaps, Box now           |
| Track      | The race on the circuit  | Session, Replay, Lap strip, the six Track tiles                  |
| Drivers    | Faces and cars           | Session, Replay, Grid, Driver, Positions chart                   |
| Pit wall   | A TV or a second monitor | Timing, Track map, Gap chart, Focus, Race control; fit to screen |

Viewers can edit any of them; Reset puts it back as shipped. There are 24 tiles in 6 groups
(Race, Drivers, Timing, Track, Analysis, Strategy). Six of them are Pro: Box now, True pace, Tyre
wear, Pit rejoin, Dominance and Speed map.

## Track tiles

Maps of the circuit, from the session's telemetry (`docs/product/telemetry.md`):

| Tile       | Shows                                                                                                  | Plan |
| ---------- | ------------------------------------------------------------------------------------------------------ | ---- |
| Track map  | Every car, the followed one emphasised; whole circuit or follow camera; sector colours; 2025 DRS zones | Free |
| Battle map | The followed driver and the cars either side: road gaps, pace difference, laps until in range          | Free |
| Flag map   | Yellow and double-yellow marshal sectors with the messages that raised them                            | Free |
| Pit rejoin | A ghost where the followed car would rejoin if it boxed now, from this circuit's pit loss              | Pro  |
| Dominance  | The circuit painted by the quickest of two or three drivers in each mini sector                        | Pro  |
| Speed map  | One lap painted by speed, gear, throttle or braking, with top speed and slow corners                   | Pro  |

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

**Proposal for the owner, Track tiles.** The map is free, as are the battle map and the flag map:
they are what a fan expects to see and the best reason to open the app on race day. The deeper
reads are Pro: pit rejoin (it extends Box now, already Pro), mini-sector dominance and the speed
map (the analysis fans compare paid products on). Each is one `pro` flag in `TILE_INFO`
(`client/src/features/dashboard/dashboards.ts`) to move.
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
