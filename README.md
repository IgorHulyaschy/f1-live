# Pitwall (f1-live)

Live and post-race Formula 1 insights: timing, battles, pit windows, tyre strategy and pace.
Working name only; the product must not use "F1" or "Formula 1" in its brand.

![Live dashboard: timing tower, followed driver and race control](docs/screenshots/live-desktop-dark.png)

| Pit wall at 2560px, fit to screen                                                                  | Building a dashboard                                                                           |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| ![Pit wall preset on a 2560px monitor](docs/screenshots/pit-wall-2560.png)                         | ![Edit mode with tile bars and resize handles](docs/screenshots/edit-mode.png)                 |
| **Analysis**                                                                                       | **Strategy**                                                                                   |
| ![Lap time chart, true pace and fastest laps](docs/screenshots/analysis-desktop-dark.png)          | ![Stints, tyre wear and pit stops](docs/screenshots/strategy-desktop-dark.png)                 |
| **Library**                                                                                        | **Drivers**                                                                                    |
| ![Ready-made and fan dashboards with layout thumbnails](docs/screenshots/library-desktop-dark.png) | ![Grid of driver plates, driver card and positions](docs/screenshots/drivers-desktop-dark.png) |

More screens (light theme, tablet, phones, edit mode): [docs/screenshots.md](docs/screenshots.md).

## Dashboards

The whole screen is tiles on a 24-column grid, from a phone to a wall monitor: the race title,
replay keys and lap strip move and resize like timing or a chart.

- **Ready-made.** Live, Analysis and Strategy (at `/`, `/analysis`, `/strategy`), Battle,
  Track, Drivers and Pit wall. Edit any of them and Reset brings it back; **+** starts your own.
- **24 tiles in 6 groups.** Race (session, replay, lap strip, weather, race control), Drivers
  (focus, driver, grid), Timing, Track (track map, battle map, pit rejoin, mini-sector
  dominance, flag map, speed map), Analysis and Strategy. Drag by the bar, resize from the edges,
  or use the keyboard: focus a grip, arrows move, Shift and arrows resize. Edit mode bars sit in
  the gaps, so a dashboard looks the same while you build it.
- **Maps.** Every car on the circuit, smooth at the display's refresh rate: from the replay's
  car positions, the live feed's positions channel, or estimated from timing when there are
  none. The replay plays at 1×, 10× or 60×.
- **Any monitor.** Panels lay out by their tile's width (container queries). **Fit** stretches
  rows to the window height; text size runs from S to TV; narrow screens stack tiles.
- **Windows.** Pop out a tile or a dashboard; lap, driver, plan, compared drivers and play/pause
  stay in sync.
- **Library and sharing.** `/library` has your dashboards, the ready-made ones and fan
  dashboards to preview and add. **Share** copies a link that carries the whole dashboard; no
  server needed. Export/Import does the same with a file.
- **First run.** `/welcome` picks the driver you follow and a starting dashboard.
- **Free and Pro.** Free keeps 3 dashboards of your own; Pro keeps any number, unlocks Pro tiles
  and publishing. Accounts and the fan library are mocked in the browser for now.
- **Pictures.** Driver photos, team logos and cars load from formula1.com in the viewer's browser,
  using the references the timing feed publishes; nothing is stored in the repo, and each has a
  drawn fallback. A paid launch needs a media licence first.

How it all fits together, what ships by default and the backend contract:
[docs/product/dashboards.md](docs/product/dashboards.md).

Design rules: [docs/design/identity.md](docs/design/identity.md). What comes next: [docs/plans](docs/plans/README.md).

## Layout

| Workspace | What it is                                                             |
| --------- | ---------------------------------------------------------------------- |
| `shared`  | Race data contract shared by server and client (`shared/src/race.ts`). |
| `server`  | One Fastify process: the live timing feed, `WS /live`, saved sessions. |
| `client`  | React 19, Vite, Tailwind 4, shadcn/ui and shadcn charts (Recharts).    |

## Getting started

```sh
npm install

# Client on the mock replay (no server or database needed)
cp client/.env.example client/.env   # VITE_DATA_SOURCE=mock
npm run dev -w client

# Client on real data: set VITE_DATA_SOURCE=api in client/.env, then run the server below

# Server: live feed, WS /live and saved sessions on one port (3000); no database needed
cp server/.env.example server/.env   # optional
npm run dev -w server

# With no session live, replay a saved one through the same live path
npm run fetch:f1 -w server -- 9858
npm run replay-live -w server -- --key 9858 --speed 10
```

The WebSocket protocol, the ingest/relay split for cloud hosts and the load smoke are in
[docs/product/live-protocol.md](docs/product/live-protocol.md).

The mock replay is the 2025 Las Vegas Grand Prix. Grid, stints, race control, weather, VSC laps
and the order at the flag are real (from `server/data-examples`); lap and sector times are
modelled and calibrated to the real gaps.

With `VITE_DATA_SOURCE=api` the client reads `catalog.json` and saved sessions from
`VITE_API_URL` and follows `WS /live` at `VITE_WS_URL`. The Session tile and ⌘K pick any
season, meeting and session (`?session=<key>` links to one); opening the app during a live
session goes to it. Live sessions can run behind the feed by a broadcast delay, and spoiler-free
mode opens sessions at the start with results hidden.

## Checks

| Command                       | What it runs                                               |
| ----------------------------- | ---------------------------------------------------------- |
| `npm run check`               | Typecheck (TypeScript 7), oxlint and Prettier.             |
| `npm run lint`                | oxlint with the anti-slop and shadcn lint plugins.         |
| `npm run format`              | Prettier.                                                  |
| `npm run test:unit -w client` | Node test runner over the mock race and insights.          |
| `npm run test:e2e`            | Playwright on the mock replay, then on real data and live. |
| `npm run shots`               | Screenshots on the mock and on real data, dark/light.      |

Shots land in `client/shots/output/<viewport>/<page>-<plan>-<theme>.png` and, on real data, in
`client/shots/output/real/` (not committed); they are meant for design and quality audits. The
real-data runs (`client/playwright.real.config.ts`) read a committed fixture of the 2025 Las Vegas
race and qualifying and 2026 Baku qualifying, derived by `client/e2e/real/derive-fixtures.ts`,
and replay a trimmed race through `replay-live`. If Playwright's own browser is not installed, point it at
any Chromium with `PW_CHROMIUM_PATH=/path/to/chrome`.

The anti-slop oxlint plugin is vendored in `tools/oxlint/anti-slop` (see `UPSTREAM.md`). shadcn
primitives live in `client/src/components/ui`; screens compose them through variants rather than
restyling them, which `@shadcn/lint` enforces.

### ROADMAP

- ⌛ - in progress
- ✅ - done
- 🔜 - coming soon

| Feature          | Progress                            | Status         |
| ---------------- | ----------------------------------- | -------------- |
| WebSocket        | ![50%](https://progress-bar.xyz/50) | ⌛ In Progress |
| Sector Colors    | ![0%](https://progress-bar.xyz/0)   | 🔜 Coming soon |
| REST Historical  | ![50%](https://progress-bar.xyz/50) | ⌛ In Progress |
| Position Changes | ![0%](https://progress-bar.xyz/0)   | 🔜 Coming soon |
| Segments         | ![0%](https://progress-bar.xyz/0)   | 🔜 Coming soon |
| Pit-stops        | ![0%](https://progress-bar.xyz/0)   | 🔜 Coming soon |
| Deltas           | ![0%](https://progress-bar.xyz/0)   | 🔜 Coming soon |
| Incidents        | ![0%](https://progress-bar.xyz/0)   | 🔜 Coming soon |
| Weather          | ![0%](https://progress-bar.xyz/0)   | 🔜 Coming soon |

### OLD ROADMAP

- [ ] ws connection with the world (highest)
- [ ] start working with sector colors and best laps (highest)
- [ ] REST to get historical data (mid)
- [ ] start working with drivers position changes in sprint/race (mid)
- [ ] start working with segments (mid)
- [ ] start working with pit-stops (mid)
- [ ] start working with deltas (low)
- [ ] analyze how to work with incidents (low)
- [ ] start work with weather (low)
