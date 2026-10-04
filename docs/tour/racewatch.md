# Watching a race closely

Who is racing whom right now, who is faster, and is the car behind really catching the one ahead?

![The Race layout: Fights, the Duel and Pace now beside the timing tower.](racewatch/race-layout.png)

_The Race layout leads with who is racing whom, who is faster, and the pace of the whole field._

![The same screen in the light theme.](racewatch/race-layout-light.png)

_Dark is the default; light is one setting away._

![The Fights tile.](racewatch/fights.png)

_Fights ranks every pair racing now and every car closing on the one ahead, with why the car behind is faster._

![The Pace now tile.](racewatch/pace-now.png)

_Pace now ranks the whole field by seconds a lap off the fastest car over recent clean laps._

![The Duel tile with two drivers picked.](racewatch/duel.png)

_The Duel compares two drivers lap by lap, with the gap and a one-line verdict._

![Lap times as seconds off the quickest car.](racewatch/delta-chart-lap-times.png)

_Lap times read as seconds off the quickest car, with stops, flags and off-scale laps marked, and names at the line ends._

![The Battle chart for one driver.](racewatch/delta-chart-battle.png)

_The Battle chart shows the gap to the car ahead, with the car named where it changes and the one-second DRS window shaded._

![Fights first on a phone.](racewatch/fights-phone.png)

_On a phone, Fights comes first._

The live key sits beside the play control while a session is running; see [Live race](live.md) for the bar in each state.

## How to get there

- `/session?session=9858&lap=22` opens the Race layout, with Fights, Duel and Pace now in place.
- Click a row in Fights, or hold `Shift` and click two rows in the timing tower, to put a pair in the Duel. The address then carries `duel=PIA,LEC`, so a duel can be shared as a link.
- `/analysis?session=9858&lap=38&duel=PIA,LEC` shows the delta charts for that pair.
- `/d/battle?session=9858&lap=30&driver=16` opens the Battle chart for one driver.
- `L` goes back to live; `Space` plays or pauses.

Product docs: [Dashboards and tiles](../product/dashboards.md) and [How people move through the app](../product/flows.md). How it is built: [the live pipeline](../architecture.md).

[Back to the tour](README.md)
