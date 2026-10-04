# Ask

Who won, who was fastest, what was the penalty and why: ask in plain words and get the answer with its proof.

![The empty Ask palette with example questions.](ask/open-empty.png)

_Press `Cmd+K` anywhere and just ask._

![An answer as a table with a proof link.](ask/result-table.png)

_Answers come as a table, with the source one click away._

![A head to head answer.](ask/head-to-head.png)

_Two drivers, one season, side by side._

![A standings answer.](ask/standings.png)

_Standings in plain words._

![A points gap answer.](ask/points-gap.png)

_Gaps in plain words._

![An answer held back by spoiler protection.](ask/held-by-spoiler-protection.png)

_With spoiler protection on, Ask holds the result until you choose to see it._

![A stewards' decision with its proof link.](ask/stewards-decision.png)

_Stewards' decisions, quoted with the FIA document they come from. This picture uses sample decisions; the committed test data has none._

![A driver fact with its proof link.](ask/wikidata-fact.png)

_Driver facts from Wikidata, each with its source. This picture uses a sample answer too._

![An answer in the light theme.](ask/result-table-light.png)

_The light theme._

![Standings answered on a phone.](ask/standings-phone.png)

_On a phone, the search button in the header opens Ask._

## How to get there

- `Cmd+K` (`Ctrl+K`) or `/` opens Ask from any screen. `Esc` closes it. `Enter` on an answer follows its proof.
- Questions that work on the committed test data: "who won monza 2024", "norris vs piastri 2024", "standings 2025", "how many points is piastri behind in 2025", "pit stops in this session" (adds a tile).
- With spoiler protection on, "who won vegas 2025" is held until you reveal it.

Product doc: [How people move through the app](../product/flows.md). How the question index is built and queried: [architecture](../architecture.md#4-the-client-routes-dashboards-tiles-insights-ask).

[Back to the tour](README.md)
