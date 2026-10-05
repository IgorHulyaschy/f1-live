# Pitwall

A hub of Formula 1 knowledge: ask any question and get the answer with its proof, dig into deep
stats, and follow any session live or replay it later without spoilers. Working name; the brand
never uses "F1" or "Formula 1".

Read first: `README.md` (commands, checks), `docs/product/flows.md` (how people move through the
app), `docs/design/identity.md` (visual rules). Older files predate some rules here: follow the
rule, not the neighbour, and say so when you hit a contradiction.

## Data

- One pipeline: a source in `server/src/sources/<provider>/` emits `RaceEvent`s, the pure
  `applyEvent` in `shared/` folds them into a `RaceSnapshot`, sinks write snapshots and the
  catalog. Live uses the same decoder and is recorded in archive format, so a finished live
  session imports like any archive session.
- Raw input is kept forever under the data directory in the archive's own format; everything
  else is rebuilt from it (`npm run rebuild -w server`). Data never enters git, only small trimmed
  fixtures.
- Sessions are keyed by the archive `Key` (9858 is the 2025 Las Vegas race).
- A wrong official result is fixed with a file in `server/corrections/` that cites its FIA
  document, never by editing raw data.
- Parse external data with zod at the source boundary; core logic stays typed and pure.

## Spoilers

A finished session the viewer has not revealed opens at its start, and no screen shows its
result. One helper decides it, `client/src/data/spoilers.ts`; every list, answer and table that
can show a result goes through it.

## Size and speed

`npm run budgets` caps the first route at 310 kB scripts and 16 kB styles (gzip) and needs
Lighthouse mobile 0.9 or better (on CI mobile performance only warns). New features load after the first route. Raise a cap only on
purpose, in `client/scripts/budgets.ts`, with the reason.

## Pictures

Driver, team and car pictures load from formula1.com in the viewer's browser and are never
stored here (`client/src/lib/media.ts`). Their terms allow personal, non-commercial use only, so
every picture has a drawn fallback and `VITE_F1_MEDIA=off` turns them all off.

## Git

- Branch from `master`, one branch per task. Commit each step with its tests in the repo's style
  (`feat(server): ...`, `fix(client): ...`); no Co-Authored-By or other attribution trailers.
- Push only your branch. The coordinator verifies it and squashes it into `master` as one commit.
- Worktrees running e2e or shots side by side set their own `PW_PORT_BASE` and run with `CI=1`.

## Done means

`npm run check`, unit tests for what you touched, `npm run test:e2e` when the client changed,
`npm run budgets`, and `npm run shots` with a design review against `docs/design/identity.md`
when the UI changed.
