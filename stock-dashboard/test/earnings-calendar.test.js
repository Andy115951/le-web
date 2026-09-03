const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildEarningsImportRecords,
  buildEarningsImportPreview,
  buildReportedEarningsFeatureEvent,
  getEarningsEvents,
  getReportedEarningsFeatureEvents,
  normalizeEarningsCandidate,
  normalizeStatusFilter,
  persistEarningsImport
} = require("../lib/earnings-calendar");
const reviewedCoreQ2 = require("../data/earnings/candidates/core-q2-2026-reported.json");

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

test("reviewed core-company candidates preserve only official calendar facts", function () {
  const records = buildEarningsImportRecords(reviewedCoreQ2, new Date("2026-09-02T00:00:00.000Z"));
  assert.deepEqual(records.events.map(function (event) { return event.symbol; }), ["AAPL", "META", "TSLA", "MSFT", "AMZN"]);
  records.events.forEach(function (event) {
    assert.equal(event.status, "reported");
    assert.equal(event.scheduledAt, null);
    assert.match(event.sourceUrl, /^https:\/\//);
    assert.ok(event.sourceTitle);
    assert.doesNotMatch(event.sourceTitle, /\bto announce\b|production, deliveries/i);
  });
  assert.equal(records.events.find(function (event) { return event.symbol === "AMZN"; }).session, "unknown");
  assert.match(records.events.find(function (event) { return event.symbol === "AAPL"; }).sourceUrl, /apple-reports-third-quarter-results/);
  assert.match(records.events.find(function (event) { return event.symbol === "META"; }).sourceUrl, /Meta-Reports-Second-Quarter-2026-Results/);
  assert.match(records.events.find(function (event) { return event.symbol === "TSLA"; }).sourceUrl, /tesla-releases-second-quarter-2026-financial-results/);
});

test("earnings import preview is local-only and distinguishes calendar-only records", function () {
  const records = buildEarningsImportRecords([{
    symbol: "META",
    marketDate: "2026-07-29",
    status: "reported",
    session: "after_market",
    sourceUrl: "https://investor.example.com/meta-results",
    provider: "Meta Investor Relations",
    sourceTitle: "Quarterly results"
  }, {
    symbol: "MSFT",
    marketDate: "2026-07-30",
    status: "reported",
    session: "after_market",
    sourceUrl: "https://investor.example.com/msft-results",
    provider: "Microsoft Investor Relations",
    sourceTitle: "Quarterly results",
    sourcePublishedAt: "2026-07-30T20:00:00.000Z"
  }], new Date("2026-08-01T00:00:00.000Z"));
  const preview = buildEarningsImportPreview(records);
  assert.deepEqual(preview.symbols, ["META", "MSFT"]);
  assert.equal(preview.statuses.reported, 2);
  assert.equal(preview.featureEligibleCount, 1);
  assert.equal(preview.calendarOnlyCount, 1);
  assert.equal(preview.requiresExplicitApproval, true);
});

test("reported earnings only become dated feature inputs with an exact official publication time", function () {
  const featureEvent = buildReportedEarningsFeatureEvent({
    eventKey: "earnings:NVDA:example",
    marketDate: "2026-08-26",
    status: "reported",
    symbol: "NVDA",
    source: { canonicalUrl: "https://investor.example.com/earnings", publishedAt: "2026-08-26T20:01:00.000Z" }
  });
  assert.deepEqual(featureEvent, {
    event_key: "earnings_calendar:earnings:NVDA:example",
    market_date: "2026-08-26",
    available_at: "2026-08-26T20:01:00.000Z",
    event_type: "earnings_reported",
    impact_level: "unknown",
    tickers: ["NVDA"]
  });
  assert.equal(buildReportedEarningsFeatureEvent({ ...featureEvent, status: "scheduled" }), null);
  assert.equal(buildReportedEarningsFeatureEvent({
    status: "reported", symbol: "NVDA", marketDate: "2026-08-26", source: { canonicalUrl: "https://investor.example.com/earnings" }
  }), null);
});

test("reported feature reads enforce the reported status at the query boundary", async function () {
  const paths = [];
  const events = await getReportedEarningsFeatureEvents({ startDate: "2026-08-01", endDate: "2026-08-31", status: "scheduled" }, {}, async function (_config, path) {
    paths.push(path);
    return [{
      event_key: "earnings:NVDA:example",
      market_date: "2026-08-26",
      event_status: "reported",
      instruments: { symbol: "NVDA" },
      sources: { canonical_url: "https://investor.example.com/earnings", published_at: "2026-08-26T20:01:00.000Z" }
    }];
  });
  assert.match(paths[0], /event_status=eq\.reported/);
  assert.equal(paths[0].includes("event_status=eq.scheduled"), false);
  assert.equal(events.length, 1);
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

test("earnings reads return a bounded public calendar shape and an optional validated status filter", async function () {
  const result = await getEarningsEvents({ startDate: "2026-08-01", endDate: "2026-08-31", status: "reported", limit: 12 }, {}, async function (_config, path) {
    assert.match(path, /market_date=gte\.2026-08-01/);
    assert.match(path, /market_date=lte\.2026-08-31/);
    assert.match(path, /event_status=eq\.reported/);
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
  assert.equal(result.status, "reported");
  assert.equal(result.events[0].symbol, "NVDA");
  assert.equal(result.events[0].scheduledAt, null);
  assert.equal(result.events[0].source.provider, "NVIDIA Investor Relations");
  assert.equal(normalizeStatusFilter("cancelled"), "cancelled");
  assert.throws(function () { normalizeStatusFilter("unknown"); }, /Invalid earnings status/);
});
