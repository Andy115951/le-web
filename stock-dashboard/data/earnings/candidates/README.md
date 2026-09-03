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

`scheduledAt` is optional and must be an exact timestamp when supplied. If an official page only states “after market” or does not publish a time, retain `scheduledAt: null` and use `session` or `unknown`; do not invent an hour. The importer defaults to a local, no-credential preview that lists symbols, statuses and feature eligibility:

```bash
npm run earnings:import -- data/earnings/candidates/<file>.json
```

Only after reviewing that plan, append the explicit approval to read server configuration and write records:

```bash
npm run earnings:import -- data/earnings/candidates/<file>.json --approve
```

This pipeline does not scrape pages, does not treat estimates as actual results, and does not create market-move attribution. Every source URL must be a reviewable `https://` IR or company source.

For a `reported` entry to become a dated input to daily research features, `sourcePublishedAt` must contain an exact, official source publication timestamp. A later `capturedAt` only means when this system saw a source and is never used to backfill a historical feature row. Candidates without that exact time remain calendar-only until better primary evidence is available.

## Reviewed candidates awaiting an explicit import

- `nvda-fy2027-q2-2026-08-26.json`: NVIDIA FY2027 Q2, scheduled.
- `core-q2-2026-reported.json`: AAPL, META, TSLA, MSFT, and AMZN Q2/FY2026 reported-event candidates, manually checked against each company's actual result announcement rather than a pre-release notice or an operating-metric update. Amazon's exact release session is not stated on its cited page, so it remains `unknown` rather than inferred. None currently carries an exact official publication timestamp, so all remain calendar-only even after a future explicit import.

Candidate files are versioned review material only. They are not production calendar rows until someone deliberately runs the import command with the exact file path and `--approve`.
