# Race watching that moves

The Race layout now answers "who is racing whom", "who is fast" and "which of these two is
quicker" in one look each, where it took four or five reads and some arithmetic before. This
page starts with the diagnosis that drove the work, then what changed and how it was checked.

## 1. Diagnosis: what a viewer could not read

Method: the Race, Battle, Analysis and Pit wall layouts on the e2e fixture of the 2025 Las Vegas
race, at 1440 × 900 and 1920 × 1080, at lap 3 (a VSC), lap 10 (a fight), lap 22 (after a round
of stops) and lap 38. Shots, not committed: `race-vsc-l3`, `race-fight-l10`, `race-afterpit-l22`,
`race-l38`, `battle-l22`, `analysis-l22` and `wall-l22`, each at `-1440` and `-1920`. A step is
one read or one sum a viewer has to do.

| Question                          | Before (Race layout)                                                                                                                                             | Steps | After                                                                    | Steps |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------ | ----- |
| Who is catching whom?             | Only for the followed driver's neighbours, in Focus's gap ladder; the rest of the field shows intervals with no trend.                                           | 3+    | Fights: every pair within a second and every car closing, soonest first. | 1     |
| Who is fast right now?            | Not on the 1440 layout. At 1920, Last lap as absolute m:ss for every car, in-laps included (NOR 1:41.141 while in the pits).                                     | 18+   | Pace now: seconds a lap off the fastest car, clean laps only.            | 1     |
| Will X pass Y, and when?          | Read the gap, read the rate, divide, think about DRS; the ladder counted a car in the pits as "closing 0.06/lap".                                                | 4     | "Within 1 s in 3 to 5 laps" and the reason, on the fight row.            | 1     |
| How do these two drivers compare? | No tile. Switch Focus twice and remember Last, Best, tyre and stops; or sum intervals for cars not side by side.                                                 | 5+    | Duel: per-lap bars, the gap line and a one-line verdict.                 | 1     |
| What just happened?               | The timeline line read "ALO passes a car; ALO passes a car; TSU passes a car; COL passes 2 cars…" and cut off before SAI's stop.                                 | 2–3   | "ALO passes COL and TSU", grouped per driver, the latest moment shown.   | 1     |
| How do I get back to live?        | "Back to live" in the bar's top left, wider than the "Live" mark it replaces, so the bar shifts about 50 px; play and the scrubber are in the Replay tile below. | 2     | "Go live" after next in the transport, the same key and size as "Live".  | 1     |

Why the time charts were hard to read:

- **Lap times** (`analysis-l22`): an absolute m:ss.mmm axis in 0.65 s steps. The fuel and tyre
  slope, about 2.5 s over the race, takes the whole axis, so the 0.1 to 0.5 s between drivers
  disappears in crossing zigzags. One slow last lap stretches the scale. Same-colour teammates
  (VER and SAI are both blue that year) are told apart only by a legend at the bottom.
- **Battle** (`battle-l22`): already a difference with a good DRS band, but "LEC to car ahead"
  never says which car, and a pass or a stop jumps the line 0.4 to 2.7 s with nothing to say why.
  X ticks stopped at L20 with the race on L22.
- **Gap to the leader** (`wall-l22`): a 140 px plot from +0 to +20 s, set by the pit-stop dives;
  LEC and SAI, 0.458 s apart, merge into one line. The leader is a flat line at the top.
- **Last-five sparkline** in the tower: five bars scaled to each driver's own best, no axis, so
  "fast" meant fast for that driver; never visible at 1440.
- **Live controls** (owner's report on the live race, demo shots `live-02` to `live-11`): the
  bar's lit "Live" mark became a wider "Back to live" key on stepping back, at the opposite end
  of the screen from play, the lap keys and the scrubber, and the bar stayed in view while the
  Replay tile scrolled away. At the live edge play, next and speed were disabled with no reason
  given, and Space did nothing. "L goes live" sat in the line under the scrubber only while
  already live (events replace it once scrubbed back) and again in the footer.
- **Gap ladder** in Focus: says HUL +8.634 where Timing says +5.772 (the ladder sums two
  intervals), and colours closing and opening alike.

## 2. What changed

- **Fights tile** (`client/src/features/watch/fights-tile.tsx`, `client/src/insights/battle.ts`).
  Pace is compared over the laps both cars drove clean since either last stopped (`pairPace`), and
  the laps to get within a second come as a range from the spread of those laps (`lapsToReach`),
  so a one-off lap does not promise a pass. Pit, SC and VSC laps never count; under a neutralised
  track the tile says so. Rows show both cars, the gap, a bar to the one-second line with an arrow
  for where the gap will be in three laps, "In DRS" or "Within 1 s in 3 to 5 laps", and the
  reason (a stop N laps ago, a softer compound, newer tyres). Pointing at a row lights the pair on
  the map and in the tower; picking it fills the Duel.
- **Pace now** tile and the tower's Pace now column (it replaces the last-five sparkline): each
  car's last five clean laps as seconds a lap off the fastest car, with the trend, compound and
  tyre age.
- **Duel** tile: any two drivers, the closest fight by default, picked by a fight row, its own
  pickers or Shift and two tower rows (`duel=PIA,LEC` in the address). Bars above and below the
  line per lap say who was faster and by how much, a line shows the gap, stops and flag laps are
  marked, and a verdict says it in words.
- **Charts** (`chart-workspace.tsx`, `lap-series.ts`): lap times read as seconds off the quickest
  car on each lap; every line ends in its driver's code; with more than two lines, the ones that
  are not the followed driver or the duel's pair go grey; axes leave out the outer 5% (10% for lap
  times) and always run through 0 in nice steps; the battle chart names the car ahead and breaks
  at a pass or a stop. The purple fastest-lap rule went: on a delta axis the quickest car is 0.
- **Removed**: the tower's last-five sparkline (`lap-trend.tsx`). It answered "is this driver
  near their own best", which no viewer asked; Pace now answers the question it stood in for.
- **Alive, not noisy**: tower rows slide on a pass, a fastest lap flashes the row purple, gaps and
  pace numbers roll to a new value (not on first paint), and with reduced motion nothing moves.
  The timeline line groups passes per driver and names who was passed.
- **Live controls**: the live key sits after previous, play and next, one size in both states:
  "Live" lit while following, "Go live" after stepping back. Following live counts as playing,
  so play (and Space) pauses it on the lap on screen, and play from the newest lap rejoins live.
  Speed stays enabled. The bar keeps only "Replay" or "Upcoming", and "Stale" or "Reconnecting"
  when the feed drops. The footer is the one list of keys; an e2e test checks that the live key,
  play, the lap keys, speed, the scrubber and the session key keep their boxes when leaving live
  and returning, by click and by Space.
- **Layout**: Race is Timing (full height), Fights and the map beside it, Duel and Pace now under
  them, Replay at the bottom right; Focus, Race control and Stints moved just below the fold (the
  ultrawide arrangement keeps Race control and Stints on the first screen). A phone stacks Replay,
  Fights, Timing, Duel, Pace now and the map, then the rest.

Spoilers: every number comes from the snapshot at the replay's lap (`snapshotAtLap`), so nothing
past the cursor reaches a tile; an e2e test opens lap 22 and checks no later lap shows.

## 3. Checks

All with `CI=1 PW_PORT_BASE=5400`, browser suites through the shared Playwright lock.

| Gate                | Command             | Result                                                                                                                                                                                            |
| ------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint, types, format | `npm run check`     | exit 0                                                                                                                                                                                            |
| Unit                | `npm run test:unit` | exit 0: 86, 418 (2 skipped) and 393 pass                                                                                                                                                          |
| e2e                 | `npm run test:e2e`  | exit 0: e2e 129, pwa 3, real/media-off/live/archive 83, stack 2 (1 skipped)                                                                                                                       |
| Budgets, Lighthouse | `npm run budgets`   | exit 0: scripts 268.6 of 310 kB, styles 14.0 of 16 kB; mobile perf 95, 92, 91                                                                                                                     |
| Shots               | `npm run shots`     | 496 pass; the two live race shots waited for a fight, fixed, then shots-live 18 pass                                                                                                              |
| Design review       | Sonnet, 12 shots    | 4 blockers raised: rounded toasts, the duel caption on the 0 tick, a blank map in the live phone shot, "PIA · LEC" (the ◂ glyph, not a dot); the first three fixed and the shots re-run (19 pass) |
| Code review         | Sonnet, branch diff | 1 blocker (two live keys on a phone) and 5 minor fixed; 2 noted below                                                                                                                             |

The fights tests run on a trimmed snapshot of the 2026-10-04 Bahrain race (11731, 48 kB, no
mini-sectors or team radio) at three moments: none behind the Safety Car on lap 8, NOR within a
second of HUL on lap 20, GAS on softs reaching SAI on hards in 2 to 3 laps on lap 20, and COL
compared with SAI only on the laps since its lap 31 stop.

## 4. Deviations

- The Race layout test now checks that no first-screen tile is cut by the fold, instead of the
  whole grid ending inside 900 px: Focus, Race control and Stints sit just below it on purpose.
- Live race shots use the trimmed two-lap live replay, which has a Virtual Safety Car on lap 2,
  so the Fights tile in them may show its note rather than rows.
- A fight within a second reads "In DRS" up to 2025 and "In OVT" (overtake mode) from 2026,
  after the season's own one-second aid.
- Picking two drivers in the tower is Shift and a click; the Fights rows and the Duel's own
  pickers are the keyboard path.
- The bar keeps "From the start" and, when a live feed drops, "Stale" or "Reconnecting"; that
  word can shift the bar, but the live key and the transport do not move.
- Tyre age after some stops is wrong in the decoder (the feed reuses a stint index); T29 fixes it
  in server/ and shared/, so the client does not work around it.

## 5. Left as is

- The Focus gap ladder still sums intervals while Timing shows the interval to the car ahead
  (HUL +8.634 against +5.772); it is labelled by its column, and changing its meaning belongs
  with Focus, not here.
- Race control rows still clip their last line in a short tile.
- `usePlayAction` has no unit test of its own; the live e2e tests cover pausing live, playing
  back into it and Space.

## 6. After the coordinator's shot review

- **Lap times chart**: a lap past the top of the scale leaves the line, which joins its
  neighbours, and shows as an arrow at the top edge in the driver's colour. Lines went grey for
  the duel's default pair, which the Analysis page never chose (VER and RUS grey while the legend
  showed them in colour); now only the followed driver and a pair the viewer picked keep colour,
  and the legend greys with the line. A team's second car is dashed with hollow dots, and every
  end label starts with a stretch of its own line, so RUS (solid) and ANT (dashed) read apart.
- **Duel default**: the closest fight with clean laps to compare, so lap 30 opens on COL and ALB
  instead of HAM, who had just stopped. Without laps together the verdict compares each driver's
  own last clean laps ("HAM is 0.58 s a lap faster over their own last clean laps"). The chart
  shows the last 20 laps, with larger labels and bars.
- **Toasts**: top right under the bar on a wide screen and above the pit board on a phone; an e2e
  test checks a live toast keeps off the live key and the scrubber.
- **Live key in replay**: a finished session has nothing live to return to, so the key is not
  drawn and the bar says "Replay"; while another session is live the bar offers "Watch live".
- **Smaller**: the Fights reason wraps instead of cutting off, and under a Safety Car, VSC or red
  flag the Fights, Pace now and Duel tiles name the flag that paused them.
