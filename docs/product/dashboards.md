# Dashboards: how the product works

The whole screen is tiles. A dashboard is a list of tiles plus where each one sits on a
24-column grid, and every part of the screen is a tile: the race title, the replay keys, the
lap strip, timing and charts. The top bar keeps only navigation, the plan and the theme. It
also shows the lap when the dashboard on screen has no Replay tile.

Everything here runs in the browser today. Wherever a server is needed, a mock stands in for
it, with the shape listed under [Backend contract](#backend-contract).

## What ships by default

| Ready-made | For                      | Tiles                                                         |
| ---------- | ------------------------ | ------------------------------------------------------------- |
| Live       | Race day on one screen   | Session, Replay, Lap strip, Timing, Focus, Race control       |
| Analysis   | Lap charts               | Lap strip, Replay, Compare, Chart, True pace, Fastest laps    |
| Strategy   | Tyres and stops          | Lap strip, Replay, Stints, Tyre wear, Pit stops               |
| Battle     | Your driver's fight      | Lap strip, Replay, Timing, Battle chart, Gaps, Box now        |
| Drivers    | Faces and cars           | Session, Replay, Grid, Driver, Positions chart                |
| Pit wall   | A TV or a second monitor | Timing, Focus, Race control, Gap chart, Stints; fit to screen |

Viewers can edit any of them; Reset puts it back as shipped. There are 18 tiles in 5 groups
(Race, Drivers, Timing, Analysis, Strategy). Three of them are Pro: Box now, True pace and Tyre wear.

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
