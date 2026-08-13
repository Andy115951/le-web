const assert = require("node:assert/strict");
const test = require("node:test");
const { buildResearchFlowReplay, getResearchFlowReplay, normalizeSnapshotId, summarizeCaptureTasks } = require("../lib/research-flow-replay");

const SNAPSHOT_ID = "123e4567-e89b-12d3-a456-426614174000";
const FINGERPRINT = "a".repeat(64);

test("research flow replay binds only real artifacts to one immutable snapshot", function () {
  const flow = buildResearchFlowReplay({
    snapshot: { id: SNAPSHOT_ID, market_date: "2026-08-11", packet_fingerprint: FINGERPRINT, captured_at: "2026-08-12T00:00:00.000Z" },
    dailyReports: [{ report_version: "daily-research-report-v1", report: { market: { symbol: "QQQ" } }, created_at: "2026-08-12T00:01:00.000Z" }],
    narrativeAudits: [
      { status: "rejected", provider: "deepseek", model: "x", narrative: { raw: "must not appear" }, validation_errors: ["private"] },
      { status: "accepted", provider: "deepseek", model: "x", narrative: { recap: "cited fact" }, created_at: "2026-08-12T00:02:00.000Z" }
    ],
    outcomeEvaluations: [{ evaluation_version: "research-outcome-20d-v1", realized_return_percent: 2.5, evaluated_at: "2026-09-09T00:00:00.000Z" }]
  });
  assert.equal(flow.stages.inputArchive.status, "archived");
  assert.equal(flow.stages.captureRun.status, "not_linked");
  assert.equal(flow.stages.dailyFactReport.status, "archived");
  assert.equal(flow.stages.modelNarrative.status, "accepted");
  assert.equal(flow.stages.modelNarrative.rejectedCount, 1);
  assert.equal(flow.stages.modelNarrative.narratives.length, 1);
  assert.equal(flow.stages.outcomeEvaluation.status, "evaluated");
  assert.equal(JSON.stringify(flow).includes("validation_errors"), false);
  assert.equal(JSON.stringify(flow).includes("must not appear"), false);
});

test("research flow replays only safe stage summaries from an exactly linked capture run", function () {
  const flow = buildResearchFlowReplay({
    snapshot: { id: SNAPSHOT_ID, packet_fingerprint: FINGERPRINT, capture_run_id: "999e4567-e89b-12d3-a456-426614174000" },
    captureTasks: [
      { task_kind: "market_collection", task_version: "market-collection-v1", status: "partial", details: { publicRowsWritten: 14, unifiedEventsWritten: 12, unifiedSourcesWritten: 30, failedSymbolCount: 2, failedSymbols: ["private-ticker"], error: "must-not-appear" } },
      { task_kind: "daily_fact_report", task_version: "daily-research-report-v1", status: "succeeded", created_at: "2026-08-12T00:01:00.000Z", details: { created: true, raw: "must-not-appear" } },
      { task_kind: "daily_fact_report", task_version: "old", status: "failed", created_at: "2026-08-11T00:01:00.000Z" },
      { task_kind: "model_recap", task_version: "research-narrative-v1", status: "disabled", failure_code: "task_failed" }
    ]
  });
  assert.equal(flow.stages.captureRun.status, "linked");
  assert.equal(flow.stages.captureRun.taskCount, 4);
  assert.deepEqual(flow.stages.captureRun.tasks.market_collection.details, {
    publicRowsWritten: 14, unifiedEventsWritten: 12, unifiedSourcesWritten: 30, failedSymbolCount: 2
  });
  assert.equal(flow.stages.captureRun.tasks.daily_fact_report.status, "succeeded");
  assert.deepEqual(flow.stages.captureRun.tasks.daily_fact_report.details, { created: true });
  assert.equal(flow.stages.captureRun.tasks.model_recap.status, "disabled");
  assert.equal(JSON.stringify(flow).includes("capture_run_id"), false);
  assert.equal(JSON.stringify(flow).includes("must-not-appear"), false);
  assert.equal(JSON.stringify(flow).includes("private-ticker"), false);
  assert.deepEqual(summarizeCaptureTasks([{ task_kind: "market_collection", status: "partial" }]), {
    market_collection: {
      status: "partial",
      taskVersion: null,
      createdAt: null,
      details: { publicRowsWritten: 0, unifiedEventsWritten: 0, unifiedSourcesWritten: 0, failedSymbolCount: 0 }
    }
  });
});

test("research flow replay reports absent artifacts without inventing a cause", function () {
  const flow = buildResearchFlowReplay({ snapshot: { id: SNAPSHOT_ID, packet_fingerprint: FINGERPRINT } });
  assert.equal(flow.stages.dailyFactReport.status, "not_archived");
  assert.equal(flow.stages.modelNarrative.status, "not_generated");
  assert.equal(flow.stages.outcomeEvaluation.status, "not_archived");
});

test("research flow replay queries exact snapshot and fingerprint keys", async function () {
  const paths = [];
  const flow = await getResearchFlowReplay({ snapshotId: SNAPSHOT_ID }, { url: "https://example.invalid" }, async function (_config, path) {
    paths.push(path);
    if (path.includes("research_packet_snapshots")) return [{ id: SNAPSHOT_ID, packet_fingerprint: FINGERPRINT, capture_run_id: "999e4567-e89b-12d3-a456-426614174000" }];
    return [];
  });
  assert.equal(flow.snapshot.id, SNAPSHOT_ID);
  assert.match(paths[0], new RegExp("id=eq\\." + SNAPSHOT_ID));
  assert.equal(paths.some(function (path) { return path.includes("daily_research_reports") && path.includes("snapshot_id=eq." + SNAPSHOT_ID); }), true);
  assert.equal(paths.some(function (path) { return path.includes("research_narrative_audits") && path.includes("packet_fingerprint=eq." + FINGERPRINT); }), true);
  assert.equal(paths.some(function (path) { return path.includes("research_narrative_audits") && path.includes("status=eq.accepted") && path.includes("select=status,provider,model,narrative,created_at"); }), true);
  assert.equal(paths.some(function (path) { return path.includes("research_narrative_audits") && !path.includes("status=eq.accepted") && path.includes("select=status,provider,model,created_at"); }), true);
  assert.equal(paths.some(function (path) { return path.includes("research_task_runs") && path.includes("capture_run_id=eq.999e4567-e89b-12d3-a456-426614174000") && path.includes("select=task_kind,task_version,status,details,created_at"); }), true);
  assert.throws(function () { normalizeSnapshotId("not-a-uuid"); }, /Invalid research snapshot id/);
});
