# NDX Candidate Snapshots

Place a newly downloaded, official Nasdaq-100 constituent/weight snapshot here as JSON. It must use the same schema as `data/ndx/2026-05-01.json` and retain the official `sourceUrl`, `effectiveDate`, and `publishedAt`.

Do not import a candidate directly. First run `npm run ndx:discover`, then create and inspect a diff report with `npm run ndx:review -- data/ndx/candidates/<file>.json --output data/ndx/reviews/<date>.json`. Only after review may the candidate be imported with `npm run ndx:import -- data/ndx/candidates/<file>.json --approve`. A file with an existing effective date is accepted only when every historical field is exactly the same; a divergent replacement is rejected.
