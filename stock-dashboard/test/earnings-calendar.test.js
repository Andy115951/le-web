const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildEarningsImportRecords,
  getEarningsEvents,
  normalizeEarningsCandidate,
  persistEarningsImport
} = require("../lib/earnings-calendar");

function candidate(overrides = {}) {
  return {
    symbol: "NVDA",
    marketDate: "2026-08-26",
    session: "after_market",
    status: "scheduled",
    fiscalPeriod: "FY2027 Q2",
    sourceUrl: "https://investor.example.com/financial-calendar?utm_source=mail",
    provider: "NVIDIA Investor Relations",
    sourceTitle: "Financial calendar",
    sourcePublishedAt: "2026-08-01T14:00:00.000Z",
    ...overrides
  };
}

test("earnings candidates preserve unknown exact times and normalize official source metadata", function () {
  const normalized = normalizeEarningsCandidate(candidate(), new Date("2026-08-02T00:00:00.000Z"));
  assert.equal(normalized.symbol, "NVDA");
  assert.equal(normalized.scheduledAt, null);
  assert.equal(normalized.session, "after_market");
  assert.equal(normalized.availableAt, "2026-08-01T14:00:00.000Z");
  assert.equal(normalized.sourceUrl, "https://investor.example.com/financial-calendar");
  assert.match(normalized.eventKey, /^earnings:NVDA:/);
  assert.throws(function () { normalizeEarningsCandidate(candidate({ sourceUrl: "javascript:alert(1)" })); }, /Unsupported source URL/);
  assert.throws(function () { normalizeEarningsCandidate(candidate({ session: "midnight" })); }, /Invalid earnings session/);
});

test("earnings import records deduplicate shared official sources without merging separate issuers", function () {
  const records = buildEarningsImportRecords({ events: [
    candidate(),
    candidate({ symbol: "MSFT", marketDate: "2026-08-27", fiscalPeriod: "FY2026 Q4" })
  ] }, new Date("2026-08-02T00:00:00.000Z"));
  assert.equal(records.events.length, 2);
  assert.equal(records.sources.length, 1);
  assert.notEqual(records.events[0].eventKey, records.events[1].eventKey);
});

test("earnings import refuses missing instruments and writes only service-side rows", async function () {
  const records = buildEarningsImportRecords(candidate(), new Date("2026-08-02T00:00:00.000Z"));
  await assert.rejects(function () {
    return persistEarningsImport({}, records, async function (_config, path) {
      if (path.includes("instruments")) return [];
      return [];
    });
  }, /Missing registered instruments: NVDA/);

  const paths = [];
  const result = await persistEarningsImport({}, records, async function (_config, path, options) {
    paths.push(path);
    if (path.includes("instruments")) return [{ id: 9, symbol: "NVDA" }];
    if (path.includes("sources")) return [{ id: "source-1", canonical_url: records.events[0].sourceUrl }];
    if (path.includes("earnings_events")) return [{ id: "event-1" }];
    throw new Error("Unexpected request");
  });
  assert.deepEqual(result, { eventsWritten: 1, sourcesWritten: 1 });
  assert.ok(paths.some(function (path) { return path.includes("earnings_events?on_conflict=event_key"); }));
});

test("earnings reads return a bounded public calendar shape", async function () {
  const result = await getEarningsEvents({ startDate: "2026-08-01", endDate: "2026-08-31", limit: 12 }, {}, async function (_config, path) {
    assert.match(path, /market_date=gte\.2026-08-01/);
    assert.match(path, /market_date=lte\.2026-08-31/);
    return [{
      event_key: "earnings:NVDA:example",
      market_date: "2026-08-26",
      scheduled_at: null,
      available_at: "2026-08-01T14:00:00.000Z",
      session: "after_market",
      event_status: "scheduled",
      fiscal_period: "FY2027 Q2",
      eps_estimate: null,
      eps_actual: null,
      revenue_estimate: null,
      revenue_actual: null,
      collector_version: "earnings-calendar-v1",
      instruments: { symbol: "NVDA", display_name: "NVIDIA" },
      sources: { provider: "NVIDIA Investor Relations", title: "Financial calendar", canonical_url: "https://investor.example.com/financial-calendar", published_at: "2026-08-01T14:00:00.000Z" }
    }];
  });
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].symbol, "NVDA");
  assert.equal(result.events[0].scheduledAt, null);
  assert.equal(result.events[0].source.provider, "NVIDIA Investor Relations");
});
