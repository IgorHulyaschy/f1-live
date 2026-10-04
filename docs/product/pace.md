# Pace: who is quicker, and by how much

One module, `client/src/insights/pace.ts`, answers every pace question. Ask, the Race pace tile and
the duel's verdict all read it, so the same question has the same number wherever it is asked.

## What counts

- **Clean laps only.** A lap counts when it is timed, is not an in-lap or out-lap, and ran under
  green (`isCleanLap`). Safety car, virtual safety car, yellow and pit laps never enter.
- **Fuel.** A car is lighter every lap: 0.055 s a lap is taken off (`fuelCorrectedSeconds`), so a
  lap late in the race is not credited for the fuel it burnt.
- **Tyre age.** The field's median slope for a compound (lap time lost per lap of tyre age, from
  every stint on it) is taken off per lap of age, floored at zero: a negative fit is the track
  rubbering in or a fuel effect larger than assumed, and crediting it would reward whoever is on the
  older set. The same slope applies to every driver on that compound, in rankings and in
  comparisons, so a floored slope is never set against a fitted one. A driver's own fit is only
  shown as fade.
- **Compound.** Each compound's new-tyre pace is shifted to the hard's, the median over every stint
  in the session on that compound, so Soft and Hard stints compare on equal tyres. The shift is used
  only when every dry compound that ran has at least two stints and the offsets keep the physical
  order (soft not slower than medium, medium not slower than hard). Otherwise no compound shift is
  made, and a verdict between drivers on different tyres says "not corrected for compound".
- **Wet tyres.** Intermediate and wet laps are left out when the session has laps on slicks, unless
  the filter asks for them. They run on another surface.
- **A driver needs three clean laps** in the span to get a pace. Fewer say nothing.

A driver's pace in a ranking is the median of those corrected laps. Only gaps mean anything: the
absolute value is a lap time as if on a new hard set with an empty tank.

A two-driver verdict leads with the laps both drove clean, uncorrected. It then gives the gap
allowing for tyres: on those laps, lap by lap, both drivers are brought to the mean tyre age of the
laps compared with the field's slope for their compound, and each compound is shifted to the hard.
Fuel and equal tyre ages cancel, so what is left is the compound offset and the effect of unequal
ages. Without enough shared laps, each driver's own laps are used the same way.

## Spans and filters

A span is the whole race, one stint number (each driver's own stint 2 covers different laps), or
the last 10 laps. A filter adds one compound. The same fits are used for every span, so changing
the span changes the laps counted and nothing else.

## Where it shows

- **Ask** reads six kinds of question. Every one gives a headline, a small table or bars, and links
  to the laps it used.

  | Question                                       | Answer                                |
  | ---------------------------------------------- | ------------------------------------- |
  | who was faster in the second stint, ver or nor | verdict, stint table, duel as proof   |
  | race pace ranking                              | bars of seconds off the best          |
  | fastest on mediums                             | the same, on one compound             |
  | ver vs nor pace                                | verdict over the race                 |
  | best long run in fp2                           | practice runs, quickest average first |
  | mercedes team mate gap                         | widest gap, or one team's             |

- **Race pace tile** (Analysis). Span and tyre pickers, bars in seconds a lap off the quickest.
  Click two drivers: the verdict for that span shows above the list, in the same words as Ask. The pair is the duel's pair, so the Duel tile follows.

## Worked example: Bahrain 2026 race (session 11731), stint 2

Question: who was faster in the second stint, VER or NOR?

1. Stint 2 is VER on Soft (laps 10 to 33) and NOR on Hard (laps 10 to 34). VER has 17 clean laps
   (14 to 32), NOR 18 (14 to 33); both drove 17 of them clean.
2. On those 17 laps VER's lap time minus NOR's has a median of -1.67 s: the like-for-like gap.
3. The field's Soft runs 0.87 s quicker than its Hard on a new set (Medium 0.29 s). These offsets
   keep the physical order from enough stints, so the shift is applied: VER's laps are moved 0.87 s
   slower to the Hard baseline. Both drivers use the field's slope for their compound (Soft 0.099,
   Hard 0.175 s a lap) around the mean tyre age of the shared laps. Taking the median of the
   lap-by-lap gaps gives 0.96 s. The compound offset alone would leave 0.80 s.
4. The verdict: "VER was 1.67 s a lap quicker than NOR in stint 2 on the 17 laps both drove clean;
   allowing for VER's Soft against NOR's Hard, 0.96 s."
5. If the fitted offsets were out of order (a soft slower than a hard, as when softs run late in
   short stints) or a compound rested on one stint, no compound shift is made and the text says
   "allowing for tyre age but not for VER's Soft against NOR's Hard". When the allowed-for gap
   points the other way from the shared laps, it says which driver is quicker.

The unit test `pace.test.ts` redoes both figures by hand, from raw lap times, and compares.

## Diagnosis: ten pace questions, steps before and after

Steps counted from the code as it stood before this change, on 11731 and the 2025 Las Vegas race
(9858). "Steps" are clicks or typed questions to reach the number.

| #   | Question                               | Before                                                        | After                      |
| --- | -------------------------------------- | ------------------------------------------------------------- | -------------------------- |
| 1   | Who has the best race pace?            | 2: open Analysis, find True pace (Pro). Last green laps only  | 1: Ask                     |
| 2   | Who was faster in stint 2, A or B?     | No path: stint charts, then arithmetic by hand                | 1: Ask                     |
| 3   | Fastest on mediums?                    | No path                                                       | 1: Ask                     |
| 4   | A against B over the race?             | 3: Duel pickers, read bars lap by lap, judge                  | 1: Ask, or 2 on the tile   |
| 5   | Pace over the last 10 laps?            | No path: True pace used "recent" laps with no way to set them | 1: Ask, or the tile's span |
| 6   | Team-mate gap?                         | No path                                                       | 1: Ask                     |
| 7   | Best long run in practice?             | 2: Long runs tile                                             | 1: Ask                     |
| 8   | Pace of one stint, all drivers?        | No path                                                       | 2: tile, span picker       |
| 9   | Is the verdict backed by the raw laps? | No path                                                       | 0: shown with the verdict  |
| 10  | Which laps made the number?            | No path                                                       | 1: each bar links to a lap |

Questions 2, 3, 5, 6 and 8 could not be answered at all before, on either race.

## Choices left to the organisation

Fuel effect (0.055 s a lap), the three-lap minimum, the 0.05 s matched threshold, the 10-lap tail and
the Pro gate on the tile are constants in `pace.ts`, `clean-laps.ts` and the tile list. They keep
their old defaults.
