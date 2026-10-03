# Manual corrections

One `<session key>.json` per session, for decisions taken after the timing feed ended that no
source reports. The importer appends them to the session's events as classification corrections,
and they win over any other source for the same driver and kind.

```json
{
	"key": 9858,
	"corrections": [
		{
			"driverNumber": "4",
			"kind": "disqualified",
			"reason": "Why, as the stewards state it",
			"at": "2025-11-23T12:00:00Z",
			"source": "https://where-the-decision-is-published",
			"note": "Optional."
		}
	]
}
```

`kind` is `disqualified`, `time_penalty` or `lap_penalty` (a penalty lap: the car is classified one
lap down). A time penalty also needs `seconds`, added to the race time (negative when the
stewards withdraw a penalty); a lapped car is re-sorted among the cars on its lap by the time it
crossed the line. `source` is required so every entry can be checked. Run `npm run rebuild -w server` after
editing.

## Constructors' points outside a session

`seasons.json` lists changes to the constructors' standings that no session carries, such as Force
India's exclusion in 2018 or Racing Point's deduction in 2020: the season, the team as the timing
feed names it, the round it counts from, the points (negative for a deduction), the reason and a
`source`. The results index carries them and the standings add them from that round on.
