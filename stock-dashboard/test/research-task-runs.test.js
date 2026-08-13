const assert = require("node:assert/strict");
const test = require("node:test");
const { RETRY_DELAY_MS, buildResearchTaskRunRows, normalizeResearchTaskRunLimit, normalizeTaskStatus, persistResearchTaskRuns, runResearchTaskWithRetry } = require("../lib/research-task-runs");

const CAPTURE_RUN_ID = "123e4567-e89b-12d3-a456-426614174000";

test("task run rows append only public stage summaries without raw errors", function () {
  const rows = buildResearchTaskRunRows({
    captureRunId: CAPTURE_RUN_ID,
    marketDate: "2026-08-11",
    createdAt: "2026-08-12T00:00:00.000Z",
    stages: {
      marketCollection: { status: "partial", publicRowsWritten: 8, unifiedEventsWritten: 7, unifiedSourcesWritten: 9, failedSymbolCount: 1, failedSymbols: ["private ticker"] },
      eventAttribution: { status: "succeeded", deterministicAttributions: 7, heuristicAttributionCount: 0, primarySourcesLinked: 7, evidenceSourcesLinked: 3, attributionsWritten: 4, sourceUrls: ["https://private.example"] },
      snapshot: { status: "succeeded", created: true, attempts: [
        { status: "failed", failureCode: "retryable_task_failure", queuedAt: "2026-08-12T00:00:00.000Z", startedAt: "2026-08-12T00:00:01.000Z", finishedAt: "2026-08-12T00:00:02.000Z", queueDelayMs: 1000 },
        { status: "succeeded", queuedAt: "2026-08-12T00:00:00.000Z", startedAt: "2026-08-12T00:00:02.250Z", finishedAt: "2026-08-12T00:00:03.000Z", queueDelayMs: 2250 }
      ] },
      dailyReport: { status: "failed", error: "database password should never appear" },
      weeklyReport: { status: "skipped", expectedBusinessDateCount: 5, archivedDailyReportCount: 2, missingDates: ["2026-08-14"] },
      narrative: { status: "disabled", created: false },
      outcomeEvaluation: { status: "succeeded", matureOutcomesWritten: 2 }
    }
  });
  assert.equal(rows.length, 8);
  assert.deepEqual(rows.map(function (row) { return row.status; }), ["partial", "succeeded", "failed", "succeeded", "failed", "skipped", "disabled", "succeeded"]);
  assert.equal(rows[2].failure_code, "retryable_task_failure");
  assert.equal(rows[4].failure_code, "task_failed");
  assert.equal(JSON.stringify(rows).includes("password"), false);
  assert.equal(JSON.stringify(rows).includes("private ticker"), false);
  assert.equal(JSON.stringify(rows).includes("private.example"), false);
  assert.equal(JSON.stringify(rows).includes("2026-08-14"), false);
  assert.deepEqual(rows[0].details, { publicRowsWritten: 8, unifiedEventsWritten: 7, unifiedSourcesWritten: 9, failedSymbolCount: 1 });
  assert.equal(rows[1].task_version, "market-attribution-agent-v1");
  assert.deepEqual(rows[1].details, { deterministicAttributions: 7, heuristicAttributionCount: 0, primarySourcesLinked: 7, evidenceSourcesLinked: 3, attributionsWritten: 4 });
  assert.equal(rows[2].attempt, 1);
  assert.equal(rows[2].duration_ms, 1000);
  assert.equal(rows[3].attempt, 2);
  assert.equal(rows[3].queue_delay_ms, 2250);
  assert.deepEqual(rows[5].details, { created: false, expectedBusinessDateCount: 5, archivedDailyReportCount: 2, calendarStatus: "unknown" });
  assert.equal(rows[7].details.matureOutcomesWritten, 2);
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

test("retry runner records a failed transient attempt before the successful retry", async function () {
  let calls = 0;
  const waits = [];
  const result = await runResearchTaskWithRetry({
    queuedAt: "2026-08-12T00:00:00.000Z",
    wait: async function (delay) { waits.push(delay); },
    run: async function () {
      calls += 1;
      if (calls === 1) throw new Error("network timeout");
      return { status: "succeeded", created: true };
    }
  });
  assert.equal(calls, 2);
  assert.deepEqual(waits, [RETRY_DELAY_MS]);
  assert.deepEqual(result.attempts.map(function (attempt) { return [attempt.status, attempt.failureCode]; }), [["failed", "retryable_task_failure"], ["succeeded", null]]);
  assert.equal(result.status, "succeeded");
});

test("retry runner leaves a non-transient failure as one safe final attempt", async function () {
  const result = await runResearchTaskWithRetry({
    run: async function () { throw new Error("invalid packet contract"); }
  });
  assert.equal(result.status, "failed");
  assert.equal(result.attempts.length, 1);
  assert.equal(result.attempts[0].failureCode, "task_failed");
  assert.equal(JSON.stringify(result.attempts).includes("invalid packet"), false);
});
