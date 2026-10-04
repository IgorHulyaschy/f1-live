# History and head to head

How did a season go, who beat whom over a range of rounds, and what is a driver's career at a glance?

![The calendar with season export.](history/calendar.png)

_Every weekend in your time, and export the season to your own calendar._

![Standings after round 11 of 2025.](history/standings-round-11.png)

_Standings after any round of any season._

![The same standings in the light theme.](history/standings-round-11-light.png)

_The light theme._

![Constructors' standings for 2021.](history/team-standings-2021.png)

_Constructors' standings, back to 2018._

![Norris against Piastri over many rounds.](history/head-to-head.png)

_Any two drivers, over any range of rounds._

![Head to head on a phone.](history/head-to-head-phone.png)

_Head to head on a phone._

![A driver page.](history/driver-page.png)

_Every driver's career at a glance._

## How to get there

- `/calendar` for the season and the `.ics` exports.
- `/standings?season=2025` for drivers, `/standings?season=2021&view=teams` for constructors.
- `/h2h` for head to head, `/drivers/lando-norris` for a driver page.
- Ask reaches the same data: `Cmd+K`, then "norris vs piastri 2024".

Product doc: [History](../product/history.md). How the results index is built: [architecture](../architecture.md#data-directory-rebuild-corrections).

[Back to the tour](README.md)
