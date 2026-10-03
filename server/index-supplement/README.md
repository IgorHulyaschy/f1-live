# Season index supplement

The archive's season indexes (`<year>/Index.json`) leave out sessions it still serves: the 2018
Australian Grand Prix, 2018 Bahrain practice and qualifying, the first nine meetings of 2024. One
`<year>.json` per season, in the index's own format, adds them; `readSeasonIndexes` merges it over
the saved index, so the importer, the catalog and a rebuild all see those sessions.

Each entry is the session's own `SessionInfo.jsonStream` from the archive, found by

```sh
npm run index-gaps -w server -- 2024                 # candidates from OpenF1's calendar (2023 on)
npm run index-gaps -w server -- 2018 --path 2018/2018-03-25_Australian_Grand_Prix/2018-03-25_Race
```

which keeps a candidate only when the archive serves it. 2022 has no season index and no session
in the archive at all, so it cannot be supplemented from here.
