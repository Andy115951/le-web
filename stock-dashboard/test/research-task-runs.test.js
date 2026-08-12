const assert = require("node:assert/strict");
const test = require("node:test");
const { buildResearchTaskRunRows, normalizeResearchTaskRunLimit, normalizeTaskStatus, persistResearchTaskRuns } = require("../lib/research-task-runs");

const CAPTURE_RUN_ID = "123e4567-e89b-12d3-a456-426614174000";

test("task run rows append only public stage summaries without raw errors", function () {
  const rows = buildResearchTaskRunRows({
    captureRunId: CAPTURE_RUN_ID,
    marketDate: "2026-08-11",
    createdAt: "2026-08-12T00:00:00.000Z",
    stages: {
      marketCollection: { status: "partial", publicRowsWritten: 8, unifiedEventsWritten: 7, unifiedSourcesWritten: 9, failedSymbolCount: 1, failedSymbols: ["private ticker"] },
      snapshot: { status: "succeeded", created: true },
      dailyReport: { status: "failed", error: "database password should never appear" },
      narrative: { status: "disabled", created: false },
      outcomeEvaluation: { status: "succeeded", matureOutcomesWritten: 2 }
    }
  });
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map(function (row) { return row.status; }), ["partial", "succeeded", "failed", "disabled", "succeeded"]);
  assert.equal(rows[2].failure_code, "task_failed");
  assert.equal(JSON.stringify(rows).includes("password"), false);
  assert.equal(JSON.stringify(rows).includes("private ticker"), false);
  assert.deepEqual(rows[0].details, { publicRowsWritten: 8, unifiedEventsWritten: 7, unifiedSourcesWritten: 9, failedSymbolCount: 1 });
  assert.equal(rows[4].details.matureOutcomesWritten, 2);
});

test("task run controls keep statuses and public reads bounded", function () {
  assert.equal(normalizeTaskStatus("unexpected"), "skipped");
  assert.equal(normalizeTaskStatus("partial"), "partial");
  assert.equal(normalizeResearchTaskRunLimit(100), 50);
  assert.equal(normalizeResearchTaskRunLimit(-1), 1);
});

test("task run persistence ignores duplicate capture stage attempts", async function () {
  let received = null;
  const result = await persistResearchTaskRuns({ url: "https://example.invalid", secretKey: "secret" }, [{ task_kind: "daily_fact_report" }], async function (_config, path, options) {
    received = { path, options };
    return [];
  });
  assert.match(received.path, /on_conflict=capture_run_id,task_kind,attempt/);
  assert.equal(received.options.headers.Prefer, "resolution=ignore-duplicates,return=representation");
  assert.equal(result.written, 0);
});
