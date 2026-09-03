const assert = require("node:assert/strict");
const test = require("node:test");
const { buildCaptureInputFreshness, buildDerivedDataFreshness, buildEarningsCalendarReadiness, buildNdxConstituentFreshness, buildResearchIntegrationReadiness, buildResearchQualityNextSteps, buildResearchQualitySummary, getCaptureInputFreshness, getDerivedDataFreshness, getEarningsCalendarReadiness, getResearchQuality } = require("../lib/research-quality");

test("integration readiness exposes only safe state labels", function () {
  const readiness = buildResearchIntegrationReadiness({ SEC_USER_AGENT: "valid contact@example.com", FRED_API_KEY: "a".repeat(32), DEEPSEEK_RESEARCH_ENABLED: "true", DEEPSEEK_RESEARCH_DATA_APPROVED: "true", DEEPSEEK_GATEWAY_COMPATIBILITY_ENABLED: "true", DEEPSEEK_API_KEY: "secret-key-value-long-enough", DEEPSEEK_MODEL: "deepseek-chat" });
  assert.deepEqual(Object.fromEntries(Object.entries(readiness).map(function ([name, item]) { return [name, item.status]; })), {
    marketCollection: "ready", earningsCalendar: "awaiting_import", secFilings: "ready", fredMacro: "ready", modelNarrative: "ready", modelGatewayCompatibility: "ready"
  });
  assert.equal(JSON.stringify(readiness).includes("secret-key"), false);
  assert.equal(JSON.stringify(buildResearchIntegrationReadiness({})).includes("missing_api_key"), false);
  const modelBase = { DEEPSEEK_API_KEY: "a".repeat(24), DEEPSEEK_MODEL: "deepseek-v4-flash" };
  assert.equal(buildResearchIntegrationReadiness(modelBase).modelNarrative.status, "disabled");
  assert.equal(buildResearchIntegrationReadiness(modelBase).modelGatewayCompatibility.status, "disabled");
  assert.equal(buildResearchIntegrationReadiness({ ...modelBase, DEEPSEEK_RESEARCH_ENABLED: "true" }).modelNarrative.status, "data_approval_required");
});

test("earnings readiness distinguishes calendar-only records from exact-time feature inputs", async function () {
  const calendarOnly = buildEarningsCalendarReadiness([{ event_status: "scheduled", sources: { published_at: null } }]);
  const ready = buildEarningsCalendarReadiness([
    { event_status: "reported", sources: { published_at: "2026-07-30T20:05:00.000Z" } },
    { event_status: "reported", sources: { published_at: null } }
  ]);
  assert.equal(calendarOnly.status, "calendar_only");
  assert.equal(ready.status, "ready");
  assert.equal(ready.reportedCount, 2);
  assert.equal(ready.featureEligibleCount, 1);

  const paths = [];
  const fetched = await getEarningsCalendarReadiness({ url: "https://example.invalid" }, async function (_config, path) {
    paths.push(path);
    return [{ event_status: "reported", sources: { published_at: "2026-07-30T20:05:00.000Z" } }];
  });
  assert.equal(fetched.status, "ready");
  assert.equal(paths[0].includes("earnings_events?select=event_status,sources(published_at)"), true);
  assert.equal(JSON.stringify(fetched).includes("example.invalid"), false);
});

test("earnings readiness degrades safely when the calendar table is unavailable", async function () {
  const value = await getEarningsCalendarReadiness({ url: "https://example.invalid" }, async function () {
    throw new Error("private database error");
  });
  assert.deepEqual(value, { status: "needs_database_setup", calendarEventCount: 0, reportedCount: 0, featureEligibleCount: 0, kind: "official_company_ir_calendar" });
  assert.equal(JSON.stringify(value).includes("private database error"), false);
});

test("capture input freshness exposes only the latest run's safe stage status", function () {
  const empty = buildCaptureInputFreshness([]);
  const current = buildCaptureInputFreshness([{
    status: "succeeded",
    market_date: "2026-09-01",
    finished_at: "2026-09-01T22:00:00.000Z",
    error_message: "must not leak",
    details: { priceHistoryStatus: "succeeded", secFilingStatus: "succeeded", fredMacroStatus: "failed", secret: "must not leak" }
  }]);
  assert.equal(empty.status, "awaiting_capture");
  assert.deepEqual(current, {
    status: "succeeded",
    marketDate: "2026-09-01",
    finishedAt: "2026-09-01T22:00:00.000Z",
    priceHistory: "succeeded",
    secFilings: "succeeded",
    fredMacro: "failed"
  });
  assert.equal(JSON.stringify(current).includes("must not leak"), false);
});

test("capture input freshness degrades without exposing a run-query error", async function () {
  const value = await getCaptureInputFreshness({ url: "https://example.invalid" }, async function () {}, async function () {
    throw new Error("private run ledger failure");
  });
  assert.deepEqual(value, {
    status: "unavailable",
    marketDate: null,
    finishedAt: null,
    priceHistory: "unknown",
    secFilings: "unknown",
    fredMacro: "unknown"
  });
  assert.equal(JSON.stringify(value).includes("private run ledger failure"), false);
});

test("capture input freshness asks for the ledger's minimal safe summary", async function () {
  let receivedOptions = null;
  await getCaptureInputFreshness({ url: "https://example.invalid" }, async function () {}, async function (options) {
    receivedOptions = options;
    return [];
  });
  assert.deepEqual(receivedOptions, { limit: 1, safeSummary: true });
});

test("research quality next steps distinguish preview, evidence review, and protected diagnostics", function () {
  const steps = buildResearchQualityNextSteps({
    captureInputs: { status: "partial", priceHistory: "succeeded", secFilings: "failed", fredMacro: "succeeded" },
    derivedData: buildDerivedDataFreshness({ latestMarketDate: "2026-08-12", featureDate: "2026-08-11", labelDate: "2026-08-12", similarDate: "2026-08-12" }),
    ndxConstituents: { status: "stale" },
    earningsCalendar: { status: "calendar_only" },
    review: { needsAttentionCount: 1 }
  });
  assert.deepEqual(steps, [
    { id: "review_latest_capture", kind: "protected_diagnostics" },
    { id: "preview_derived_rebuild", kind: "preview_only" },
    { id: "review_ndx_official_snapshot", kind: "official_evidence" },
    { id: "review_earnings_calendar", kind: "official_evidence" },
    { id: "review_event_evidence", kind: "human_review" }
  ]);
  assert.equal(JSON.stringify(steps).includes("--approve"), false);
});

test("research quality next steps do not suggest rebuilding before a market date exists", function () {
  const steps = buildResearchQualityNextSteps({
    captureInputs: buildCaptureInputFreshness([]),
    derivedData: buildDerivedDataFreshness({}),
    ndxConstituents: { status: "current" },
    earningsCalendar: { status: "ready" },
    review: { needsAttentionCount: 0 }
  });
  assert.deepEqual(steps, []);
});

test("research quality summary reports coverage without pretending it is a recommendation", function () {
  const summary = buildResearchQualitySummary({
    health: { snapshotCount: 2, matureOutcomeCount: 1, latestCapture: { status: "succeeded" } },
    daily: { count: 2 },
    weekly: { count: 1 },
    review: { totalCount: 8, needsAttentionCount: 3, unreviewedCount: 4 },
    tasks: {
      count: 2,
      runs: [
        { task_kind: "daily_fact_report", status: "succeeded", market_date: "2026-08-11", task_version: "daily-research-report-v1", created_at: "2026-08-12T00:00:00.000Z", raw_error: "must not leak" },
        { task_kind: "daily_fact_report", status: "failed", market_date: "2026-08-10" }
      ]
    },
    derivedData: buildDerivedDataFreshness({ latestMarketDate: "2026-08-12", featureDate: "2026-08-12", labelDate: "2026-08-11", similarDate: "2026-08-10" })
  });
  assert.equal(summary.coverage.pendingOutcomeEvaluations, 1);
  assert.equal(summary.review.needsAttention, 3);
  assert.equal(summary.operations.taskLedgerState, "recording");
  assert.equal(summary.operations.latestStages.daily_fact_report.status, "succeeded");
  assert.equal(summary.derivedData.dailyFeatures.status, "current");
  assert.equal(summary.derivedData.forwardLabels.status, "stale");
  assert.equal(summary.derivedData.similarDays.status, "stale");
  assert.equal(JSON.stringify(summary).includes("raw_error"), false);
  assert.match(summary.limitations.join(" "), /does not provide a forecast/);
});

test("derived data freshness remains conservative when materializations are absent", function () {
  const freshness = buildDerivedDataFreshness({ latestMarketDate: "2026-08-12" });
  assert.equal(freshness.dailyFeatures.status, "not_materialized");
  assert.equal(freshness.forwardLabels.status, "not_materialized");
  assert.equal(freshness.similarDays.status, "not_observed");
  assert.equal(buildDerivedDataFreshness({}).dailyFeatures.status, "awaiting_market_data");
});

test("NDX constituent freshness distinguishes current, aging, stale, and invalid chronology", function () {
  const current = buildNdxConstituentFreshness({ asOfDate: "2026-08-15", effectiveDate: "2026-08-01", sourceUrl: "https://www.nasdaq.com/ndx.pdf", constituentCount: 101 });
  assert.equal(current.status, "current");
  assert.equal(current.sourceUrl, "https://www.nasdaq.com/ndx.pdf");
  assert.equal(buildNdxConstituentFreshness({ asOfDate: "2026-08-15", effectiveDate: "2026-06-01", constituentCount: 101 }).status, "aging");
  assert.equal(buildNdxConstituentFreshness({ asOfDate: "2026-08-15", effectiveDate: "2026-05-01", constituentCount: 101 }).status, "stale");
  assert.equal(buildNdxConstituentFreshness({ asOfDate: "2026-08-15", effectiveDate: "2026-09-01", constituentCount: 101 }).status, "inconsistent_future");
  assert.equal(buildNdxConstituentFreshness({ asOfDate: "2026-08-15" }).status, "awaiting_snapshot");
  assert.equal(buildNdxConstituentFreshness({ asOfDate: "2026-08-15", effectiveDate: "2026-08-01", sourceUrl: "javascript:alert(1)" }).sourceUrl, null);
});

test("derived data freshness queries only public dates and a bounded QQQ scope", async function () {
  const paths = [];
  const result = await getDerivedDataFreshness({ url: "https://example.invalid" }, async function (_config, path) {
    paths.push(path);
    if (path.includes("/instruments")) return [{ id: "qqq-id", symbol: "QQQ" }];
    if (path.includes("/price_bars_daily")) return [{ market_date: "2026-08-12" }];
    if (path.includes("/daily_market_features")) return [{ market_date: "2026-08-12" }];
    if (path.includes("/market_forward_labels")) return [{ market_date: "2026-08-11" }];
    if (path.includes("/similar_day_matches")) return [{ target_market_date: "2026-08-10" }];
    return [];
  });
  assert.equal(result.dailyFeatures.status, "current");
  assert.equal(result.forwardLabels.status, "stale");
  assert.equal(paths.every(function (path) { return !/api[_-]?key|authorization|error_message/i.test(path); }), true);
  assert.equal(paths.some(function (path) { return path.includes("similar_day_matches") && path.includes("limit=1"); }), true);
});

test("research quality safely composes independently injected read sources", async function () {
  const quality = await getResearchQuality({
    config: { url: "https://example.invalid" },
    getHealth: async function () { return { snapshotCount: 0, matureOutcomeCount: 0, latestCapture: null }; },
    getDailyReports: async function () { return { count: 0, reports: [] }; },
    getWeeklyReports: async function () { return { count: 0, reports: [] }; },
    getReviewQueue: async function () { return { totalCount: 0, needsAttentionCount: 0, unreviewedCount: 0 }; },
    getTaskRuns: async function () { return { count: 0, runs: [] }; },
    getDerivedFreshness: async function () { return buildDerivedDataFreshness({}); },
    getNdxSnapshot: async function () { return { effective_date: "2026-08-01", constituent_count: 101 }; },
    getCaptureRuns: async function () { return [{ status: "succeeded", market_date: "2026-08-12", details: { priceHistoryStatus: "succeeded", secFilingStatus: "succeeded", fredMacroStatus: "succeeded" } }]; },
    getEarningsReadiness: async function () { return { status: "calendar_only", calendarEventCount: 1, reportedCount: 0, featureEligibleCount: 0 }; },
    getIntegrationReadiness: function () { return { modelNarrative: { status: "needs_configuration" } }; }
  });
  assert.equal(quality.coverage.researchSnapshots, 0);
  assert.equal(quality.operations.taskLedgerState, "awaiting_next_capture");
  assert.equal(quality.ndxConstituents.status, "current");
  assert.equal(quality.integrations.earningsCalendar.status, "calendar_only");
  assert.equal(quality.captureInputs.priceHistory, "succeeded");
  assert.equal(quality.nextSteps.some(function (step) { return step.id === "review_earnings_calendar"; }), true);
  assert.equal(quality.limitations.some(function (item) { return item.includes("No archived research snapshot"); }), true);
});

test("research quality uses the New York market date for constituent freshness", async function () {
  let requestedAsOf = null;
  const quality = await getResearchQuality({
    config: { url: "https://example.invalid" },
    now: new Date("2026-08-15T01:30:00.000Z"),
    getHealth: async function () { return { snapshotCount: 0, matureOutcomeCount: 0, latestCapture: null }; },
    getDailyReports: async function () { return { count: 0, reports: [] }; },
    getWeeklyReports: async function () { return { count: 0, reports: [] }; },
    getReviewQueue: async function () { return { totalCount: 0, needsAttentionCount: 0, unreviewedCount: 0 }; },
    getTaskRuns: async function () { return { count: 0, runs: [] }; },
    getDerivedFreshness: async function () { return buildDerivedDataFreshness({}); },
    getNdxSnapshot: async function (asOfDate) { requestedAsOf = asOfDate; return { effective_date: "2026-08-01", constituent_count: 101 }; },
    getCaptureRuns: async function () { return []; },
    getEarningsReadiness: async function () { return { status: "awaiting_import" }; },
    getIntegrationReadiness: function () { return {}; }
  });
  assert.equal(requestedAsOf, "2026-08-14");
  assert.equal(quality.ndxConstituents.asOfDate, "2026-08-14");
});
