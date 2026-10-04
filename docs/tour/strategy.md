# Strategy insights

Who is on which tyre, did the undercut work, and who is really the fastest once fuel and tyre age are taken out?

![The Strategy dashboard on a phone.](strategy/strategy-phone.png)

_Every tile also works on a phone._

## Tyres and stops

![Stints.](strategy/stints.png)

_Stints: who is on which tyre, and when do they pit?_

![The undercut ledger.](strategy/undercut-ledger.png)

_Undercut ledger: did the undercut work?_

![Tyre wear.](strategy/tyre-wear.png)

_Tyre wear: how fast is each tyre losing time, and when is a new set quicker?_

![Stop cost.](strategy/stop-cost.png)

_Stop cost: what does a pit stop cost at this circuit?_

![Pit crews.](strategy/pit-crews.png)

_Pit crews: whose crew is quickest?_

![Tyre wear and stop cost in the light theme.](strategy/tyre-wear-and-stop-cost-light.png)

_Both tiles in the light theme._

## Battles and pace

![Battle gaps and Box now.](strategy/battle-gaps-and-box-now.png)

_Battle: who is ahead and behind my driver, and is the gap closing or opening?_

![Battle timing and Box now.](strategy/battle-timing-box-now.png)

_Box now: what happens to my driver's position if they pit this lap?_

![Race pace.](strategy/race-pace.png)

_Race pace: who is really quickest once fuel, tyre age and compound are taken out? Pick a span and a tyre._

![Race pace with two drivers picked.](strategy/race-pace-pair.png)

_Pick two drivers and the tile gives the verdict: the gap on the laps both drove clean, then allowing for tyre age. How it is worked out: [pace](../product/pace.md)._

![Lap time chart.](strategy/lap-time-chart.png)

_Lap times: how did each driver's pace move through the race?_

![Race story.](strategy/race-story.png)

_Race story: what happened, and when?_

## How to get there

- `/strategy?session=9858&plan=pro`: stints, wear, stops and the undercut ledger.
- `/d/battle?session=9858&lap=30&plan=pro`: gaps and Box now.
- `/analysis?session=9858&plan=pro`: race pace and the lap time chart.
- `/d/story?session=9858&plan=pro`: the race story.
- In the bar, use the Strategy, Battle and Analysis tabs, or More, then Race story.

Product doc: [Dashboards and tiles](../product/dashboards.md). How the insights are computed and loaded: [architecture](../architecture.md#4-the-client-routes-dashboards-tiles-insights-ask).

[Back to the tour](README.md)
