# History: seasons, standings and head to head

Pages built on the **results index**, one file per season (`out/results/<season>.json.gz`, served
at `/results/<season>.json.gz`, contract in `shared/src/results.ts`). Seasons from 2018 on come
from the official archive; 2025 and 2026 also keep every topic.

## Pages

| Route          | What it shows                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `/calendar`    | A season's weekends in the viewer's time, the next session counted down, `.ics` export (each event links to its session). No results shown. |
| `/standings`   | Drivers' or constructors' table for any season after any round (`?season=2025&round=11&view=teams`).                                        |
| `/drivers/:id` | Career numbers, season by season, every weekend (quali, sprint, race link to the session), teammates, facts and penalties per season.       |
| `/h2h`         | Any two drivers or teams over a range of rounds. See below.                                                                                 |

The season switcher (prev, next and a search list) is shared by the session picker, the calendar,
standings and driver page. The Season menu in the header and ⌘K open each page. The dashboard tile
"Season standings" shows the open session's season after the latest round the viewer has seen.

## Head to head

`?a=lando-norris&b=oscar-piastri` with `preset=teammates|season|career` or `from=2023.1&to=2025.24`
(season.round). `mode=teams` compares team lines (`client/src/insights/teams.ts` maps renames).

Rules, as stated on the page:

- Qualifying counts the higher grid slot; a race counts the better finish when at least one of them
  was classified; a sprint the same.
- A DNF is a retirement short of the classification distance (90 % of the leader's laps, rounded
  down). A car that retires after the flag has finished.
- Qualifying gap (average, median, in ms and %) is for teammates only; best parts exclude pit laps,
  deleted laps and laps over 1.25 times the part's fastest.

Pure functions, unit-tested on real data: `insights/head-to-head.ts` (totals, breakdowns, rolling
gap), `insights/h2h-facts.ts` (ranked facts, each with links to the sessions it rests on).
Totals for Hamilton/Bottas 2018 to 2021 and Norris/Piastri 2023 to 2025 are checked against the
Jolpica API in the tests.

**Spoilers.** On history pages a session counts only if it is revealed or older than 30 days
(`heldFromHistory`). The page says "N sessions hidden" with "Reveal to include".

**Sharing.** Copy link keeps the pair and range. Card (Pro) saves a 1080 × 1350 picture drawn with
the gap card's frame (`features/history/h2h-card.ts`).

## Points and the accuracy gate

`shared/src/points.ts` holds the points rules per season (pure, tested): race 25 to 1, sprint 3-2-1
in 2021 and 8 to 1 from 2022, half points for shortened races before 2022 and the sliding scale
after, the fastest-lap point 2019 to 2024.

`server/src/results/official-standings.test.ts` checks the final driver and constructor tables of
every imported season against formula1.com. Decisions made after a race that the feed does not
carry are in `server/corrections/` (per session) and `seasons.json` (team adjustments); unserved
time penalties are derived by `UnservedPenalties`.

## Importing seasons

`npm run import -w server -- 2018,2019 --no-telemetry` fetches the results topics only (2025 on
keeps all topics; `--all-topics` forces it; `--min-free-gb 15` stops when the disk is low).
`npm run index-gaps -w server` writes `server/index-supplement/<year>.json` for sessions the archive
index leaves out (2018 Australia and Bahrain, 2024 rounds 1 to 9, and the 2021 session without an
end date). Gaps: 2022 returns 403 for every request, so it has no data; 2019 Japan Practice 3 and
2023 Imola were cancelled. Pre-2018 data is a plug-in point; see the owner items in the task report.

## Stewards' decisions and facts

Two more files sit beside the results index. Both are rebuilt by `npm run rebuild -w server` from
files saved under the data directory, and served as `/decisions/<season>.json` and `/facts.json`.

| Answer                                                                                                                 | Where it comes from                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Penalties and investigations of a session or a driver's season: the call, the infringement, a link to the FIA document | The FIA documents site (fia.com, 2019 on; it has no 2018). `npm run decisions -w server` lists each event's documents, reads each decision's PDF text (`server/src/sources/fia/`) and keeps only the structured fields and the document address. PDFs are never stored; a document it cannot read keeps its title and link. |
| A driver's birth date, age, birthplace and nationality                                                                 | Wikidata (CC0), `npm run facts -w server`.                                                                                                                                                                                                                                                                                  |
| A circuit's length, opening year and location                                                                          | Wikidata, same command.                                                                                                                                                                                                                                                                                                     |
| "Youngest race winner since 2018"                                                                                      | Race winners of the results index and the birth dates above, counting only races the viewer has revealed.                                                                                                                                                                                                                   |

Our ids reach Wikidata through `server/src/sources/wikidata/ids.ts`, a reviewed list; a test fails
when a driver or circuit of the results index is missing from it. The fetch is cached in the data
directory (a few requests per second, a User-Agent that names the app), so a rebuild never calls
out. Facts show with the Wikidata item they came from; a decision shows with its FIA document.

Where they show: the driver page (Facts, Penalties by season), the race control panel (Stewards'
documents of the session on screen) and Ask ("Why was Norris penalised in
Las Vegas?", "Penalties for Verstappen this season", "How old is Alonso?", "Youngest race winner
since 2018"), each answer with its link. A penalty can give away a result, so all of them follow
the spoiler rule: a decision belongs to its session (or its weekend's race), and is held back, with
a count (Ask shows the Reveal step instead), until that session is revealed; in a replay a document appears once the feed has reached
the time it came out.

Limits: a decision's session is read from the document, and one that names none (a summons) takes
the last session that had started when it came out. Five document formats (107% rule, protests,
right-of-review panels) stay unreadable and show their title only. 2022 has no results index (see
Importing seasons), so its decisions carry no session and stay held back.
