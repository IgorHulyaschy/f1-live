# Pitwall (f1-live)

Live and post-race Formula 1 insights: timing, battles, pit windows, tyre strategy and pace.
Working name only; the product must not use "F1" or "Formula 1" in its brand.

![Live dashboard: timing tower, followed driver and race control](docs/screenshots/live-desktop-dark.png)

| Pit wall at 2560px, fit to screen                                                         | Building a dashboard                                                           |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ![Pit wall preset on a 2560px monitor](docs/screenshots/pit-wall-2560.png)                | ![Edit mode with tile bars and resize handles](docs/screenshots/edit-mode.png) |
| **Analysis**                                                                              | **Strategy**                                                                   |
| ![Lap time chart, true pace and fastest laps](docs/screenshots/analysis-desktop-dark.png) | ![Stints, tyre wear and pit stops](docs/screenshots/strategy-desktop-dark.png) |

More screens (light theme, tablet, phones, edit mode): [docs/screenshots.md](docs/screenshots.md).

## Dashboards

Every page is a dashboard: tiles on a 24-column grid, made to work on any screen from a phone to
a wall monitor.

- **Presets.** Live, Analysis and Strategy (at `/`, `/analysis`, `/strategy`), Battle and Pit
  wall. Presets can be edited and reset; **+** starts your own.
- **Tiles.** Timing, focus, gaps, box now, race control, chart (lap times, gap, positions,
  battle), compare, true pace, fastest laps, stints, tyre wear and pit stops. Drag by the bar,
  resize from the edges, or use the keyboard: focus a grip, arrows move, Shift and arrows resize.
- **Any monitor.** Panels lay out by their tile's width (container queries), not the screen's.
  **Fit** stretches rows to the window height; text size runs from S to TV; narrow screens stack
  tiles in reading order.
- **Windows.** Open a tile or a whole dashboard in its own window. Lap, followed driver, plan,
  compared drivers and play/pause stay in sync across windows.
- **Sharing.** Export a dashboard as JSON and import it anywhere. Dashboards are saved in the
  browser; there is no account sync yet.

Design rules: [docs/design/identity.md](docs/design/identity.md).

## Layout

| Workspace | What it is                                                                   |
| --------- | ---------------------------------------------------------------------------- |
| `shared`  | Race data contract shared by server and client (`shared/src/race.ts`).       |
| `server`  | Fastify + Postgres. Subscribes to the live timing feed and serves `/onLoad`. |
| `client`  | React 19, Vite, Tailwind 4, shadcn/ui and shadcn charts (Recharts).          |

## Getting started

```sh
npm install

# Client on the mock replay (no server or database needed)
cp client/.env.example client/.env   # VITE_DATA_SOURCE=mock
npm run dev -w client

# Server against Postgres and the live feed
cp server/.env.example server/.env   # set DATABASE_URL
npm run migrations:up -w server
npm run dev -w server
```

The mock replay is the 2025 Las Vegas Grand Prix. Grid, stints, race control, weather, VSC laps
and the order at the flag are real (from `server/data-examples`); lap and sector times are
modelled and calibrated to the real gaps. Set `VITE_DATA_SOURCE=api` to read from the server.

## Checks

| Command                       | What it runs                                                |
| ----------------------------- | ----------------------------------------------------------- |
| `npm run check`               | Typecheck (TypeScript 7), oxlint and Prettier.              |
| `npm run lint`                | oxlint with the anti-slop and shadcn lint plugins.          |
| `npm run format`              | Prettier.                                                   |
| `npm run test:unit -w client` | Node test runner over the mock race and insights.           |
| `npm run test:e2e`            | Playwright against the mock replay.                         |
| `npm run shots`               | Screenshots of every page at 6 sizes, free/Pro, dark/light. |

Shots land in `client/shots/output/<viewport>/<page>-<plan>-<theme>.png` (not committed) and are
meant for design and quality audits. If Playwright's own browser is not installed, point it at
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
