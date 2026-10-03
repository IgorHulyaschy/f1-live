# Pitwall identity: "timing screen"

Pitwall should read like the timing screens and pit boards teams actually use, not like a SaaS dashboard.
These rules keep it that way. Tokens live in `client/src/index.css`.

## Colour

- Chrome is monochrome: carbon (dark) and bone (light). No brand accent.
- Colour carries meaning only, and only the meanings F1 itself uses:
  - `--fastest` purple: overall fastest lap or sector.
  - `--personal-best` green: a driver's personal best.
  - `--flag` yellow: yellow flags, VSC, safety car, pit-lane state.
  - `--danger` red: red flag, penalties, retirements, and the places of the qualifying drop zone
    (cars that would go out if the part ended now).
  - `--blue-flag` blue: blue flags.
  - Tyre compounds use their regulation colours. Hard is drawn hollow, never as a white block.
- `--focus` is the team colour of the driver you follow. It is set once on the app root and drives
  the nav underline, wordmark, stint cursor and the position chip. Change the driver and the whole
  console re-tints.
- Sectors that are neither fastest nor personal best stay neutral. Don't add yellow "slower" sectors.

## Type

- Hubot Sans (variable width) for words. `type-wide` for titles and driver codes,
  `type-narrow` for dense labels, `type-label` for printed field labels.
- Martian Mono for every number, with tabular and slashed-zero figures. `Digits` dims leading
  zeros and signs so the significant part of a gap reads first.

## Shape

- Radius is 0 everywhere.
- No cards. A panel opens with a heavy rule and a printed label (`PanelHeader`), content sits
  on hairlines.
- Never use dots or circles as separators. Use labelled fields (`Field`) and vertical rules.
- Angled cuts (`cut-forward`, `cut-corner`) are reserved for the wordmark, position chips and
  the pit board, so they keep meaning "this is a car".
- `hatch` marks gated or neutralised areas.

## Controls

- Switches, tabs, toggles and pills are replaced by hardware-style keys (`Key`, `KeyGroup`):
  square, mono caps, thicker bottom edge, solid fill when pressed.
- Every primary action has a keyboard shortcut; the footer prints them on desktop.

## Signature elements

- Race barcode (`LapStrip`): one bar per lap; height is pit traffic, yellow for flag laps,
  a purple cap where the fastest lap fell. It is the track of the Replay tile's timeline, with
  the events marked over it as small blocks in the story's colours and each qualifying part's
  start ruled across it.
- Live strip: one line under the top bar on every page. "Live" is lit like an on-air sign (solid
  foreground, the only filled key in the strip); the time left is the largest number on it; the
  drop zone is a row of team-striped codes, labelled, never coloured by team as a block.
- Flag banner: a full-width band that wipes in under the header when the track status changes.
- Pit board: on phones a sticky bottom bar for the followed driver, like the board held over
  the pit wall.
- Ghost row (Pro): where the followed driver would rejoin if they boxed now, drawn in the tower.

## Motion

- Motion explains change: rows slide on position swaps, the flag banner wipes, the nav
  underline follows. No decorative loops. Everything respects reduced motion.

## Charts

- Straight lines between laps, per-lap dots on lap times, ticks every 5 laps.
- No gradients. Neutralised laps are a faint `--flag` band. The DRS window is a faint neutral band.
- The second car of a team is dashed instead of getting an invented colour.

## Dashboards

- Every page is a dashboard: tiles on a 24-column grid. `/` is the session's own layout (Race,
  Quali or Practice); Analysis and Strategy are presets at their old addresses; Battle and Pit
  wall are presets for focused and wide screens.
- One primary reading per screen: on the session layouts it is the time left (or the lap) on the
  live strip and the tower under it. The Replay tile prints the minute only on the clock, so a
  race's lap is printed once.
- Tiles for another kind of session never fill a tile with an apology: they are left out of the
  session layouts and shrink to a dashed line with a `hatch` mark elsewhere.
- Panels size themselves to their tile with container queries (`@container` on `Panel`), never
  to the screen, so a narrow tile on a 4K monitor looks like a phone-width panel.
- Below 64rem of width the grid stacks tiles in reading order at natural height.
- Edit mode is quiet: a dashed tile bar to drag, corner ticks to resize. No wiggle, no
  confetti, no gamified empty states.
- Text size (S to TV) scales rem, so tiles, type and grid rows grow together on wall screens.
- Lap, followed driver, plan and compared drivers stay in step across every open window.
