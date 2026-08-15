# Earnings Calendar Candidates

Place manually reviewed, official company Investor Relations earnings-calendar candidates here. A candidate is either an array or an object with an `events` array. Every entry requires `symbol`, `marketDate`, `sourceUrl`, `provider`, and `sourceTitle`.

```json
{
  "events": [
    {
      "symbol": "NVDA",
      "marketDate": "2026-08-26",
      "session": "after_market",
      "status": "scheduled",
      "fiscalPeriod": "FY2027 Q2",
      "sourceUrl": "https://investor.example.com/earnings",
      "provider": "NVIDIA Investor Relations",
      "sourceTitle": "NVIDIA financial calendar",
      "sourcePublishedAt": "2026-08-01T14:00:00Z"
    }
  ]
}
```

`scheduledAt` is optional and must be an exact timestamp when supplied. If an official page only states “after market” or does not publish a time, retain `scheduledAt: null` and use `session` or `unknown`; do not invent an hour. The importer records when the source became available and requires an explicit `--approve`:

```bash
npm run earnings:import -- data/earnings/candidates/<file>.json --approve
```

This pipeline does not scrape pages, does not treat estimates as actual results, and does not create market-move attribution. Every source URL must be a reviewable `https://` IR or company source.
