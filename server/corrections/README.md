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

`kind` is `disqualified` or `time_penalty`; a time penalty also needs `seconds`, added to the race
time. `source` is required so every entry can be checked. Run `npm run rebuild -w server` after
editing.
