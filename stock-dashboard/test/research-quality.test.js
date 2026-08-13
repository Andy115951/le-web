const assert = require("node:assert/strict");
const test = require("node:test");
const { buildResearchIntegrationReadiness, buildResearchQualitySummary, getResearchQuality } = require("../lib/research-quality");

test("integration readiness exposes only safe state labels", function () {
  const readiness = buildResearchIntegrationReadiness({ SEC_USER_AGENT: "valid contact@example.com", FRED_API_KEY: "a".repeat(32), DEEPSEEK_RESEARCH_ENABLED: "true", DEEPSEEK_RESEARCH_DATA_APPROVED: "true", DEEPSEEK_API_KEY: "secret-key-value-long-enough", DEEPSEEK_MODEL: "deepseek-chat" });
  assert.deepEqual(Object.fromEntries(Object.entries(readiness).map(function ([name, item]) { return [name, item.status]; })), {
    marketCollection: "ready", secFilings: "ready", fredMacro: "ready", modelNarrative: "ready"
  });
  assert.equal(JSON.stringify(readiness).includes("secret-key"), false);
  assert.equal(JSON.stringify(buildResearchIntegrationReadiness({})).includes("missing_api_key"), false);
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
    }
  });
  assert.equal(summary.coverage.pendingOutcomeEvaluations, 1);
  assert.equal(summary.review.needsAttention, 3);
  assert.equal(summary.operations.taskLedgerState, "recording");
  assert.equal(summary.operations.latestStages.daily_fact_report.status, "succeeded");
  assert.equal(JSON.stringify(summary).includes("raw_error"), false);
  assert.match(summary.limitations.join(" "), /does not provide a forecast/);
});

test("research quality safely composes independently injected read sources", async function () {
  const quality = await getResearchQuality({
    config: { url: "https://example.invalid" },
    getHealth: async function () { return { snapshotCount: 0, matureOutcomeCount: 0, latestCapture: null }; },
    getDailyReports: async function () { return { count: 0, reports: [] }; },
    getWeeklyReports: async function () { return { count: 0, reports: [] }; },
    getReviewQueue: async function () { return { totalCount: 0, needsAttentionCount: 0, unreviewedCount: 0 }; },
    getTaskRuns: async function () { return { count: 0, runs: [] }; },
    getIntegrationReadiness: function () { return { modelNarrative: { status: "needs_configuration" } }; }
  });
  assert.equal(quality.coverage.researchSnapshots, 0);
  assert.equal(quality.operations.taskLedgerState, "awaiting_next_capture");
  assert.equal(quality.limitations.some(function (item) { return item.includes("No archived research snapshot"); }), true);
});
