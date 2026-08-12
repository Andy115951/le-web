const { getSupabaseConfig, requestSupabase } = require("./supabase-server");
const { normalizeDate } = require("./market-calendar");
const { RESEARCH_PACKET_SNAPSHOT_VERSION } = require("./research-packet-snapshots");
const { DAILY_RESEARCH_REPORT_VERSION } = require("./daily-research-reports");
const { RESEARCH_OUTCOME_EVALUATION_VERSION } = require("./research-outcome-evaluations");

const RESEARCH_TASK_RUN_VERSION = "research-task-run-v1";
const TASK_KINDS = new Set(["market_collection", "research_input_snapshot", "daily_fact_report", "model_recap", "outcome_evaluation"]);
const TASK_STATUSES = new Set(["succeeded", "partial", "skipped", "failed", "disabled"]);

function normalizeTaskStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return TASK_STATUSES.has(status) ? status : "skipped";
}

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0;
}

function buildResearchTaskRunRows(input) {
  const captureRunId = String(input?.captureRunId || "").trim();
  if (!/^[a-f0-9-]{36}$/i.test(captureRunId)) throw new Error("A capture run id is required");
  const marketDate = normalizeDate(input?.marketDate);
  const stages = input?.stages || {};
  const createdAt = input?.createdAt || new Date().toISOString();
  const rows = [
    {
      task_kind: "market_collection",
      task_version: "market-collection-v1",
      result: stages.marketCollection,
      details: {
        publicRowsWritten: finiteNonNegative(stages.marketCollection?.publicRowsWritten),
        unifiedEventsWritten: finiteNonNegative(stages.marketCollection?.unifiedEventsWritten),
        unifiedSourcesWritten: finiteNonNegative(stages.marketCollection?.unifiedSourcesWritten),
        failedSymbolCount: finiteNonNegative(stages.marketCollection?.failedSymbolCount)
      }
    },
    {
      task_kind: "research_input_snapshot",
      task_version: RESEARCH_PACKET_SNAPSHOT_VERSION,
      result: stages.snapshot,
      details: { created: Boolean(stages.snapshot?.created) }
    },
    {
      task_kind: "daily_fact_report",
      task_version: DAILY_RESEARCH_REPORT_VERSION,
      result: stages.dailyReport,
      details: { created: Boolean(stages.dailyReport?.created) }
    },
    {
      task_kind: "model_recap",
      task_version: "research-narrative-v1",
      result: stages.narrative,
      details: { created: Boolean(stages.narrative?.created) }
    },
    {
      task_kind: "outcome_evaluation",
      task_version: RESEARCH_OUTCOME_EVALUATION_VERSION,
      result: stages.outcomeEvaluation,
      details: { matureOutcomesWritten: finiteNonNegative(stages.outcomeEvaluation?.matureOutcomesWritten) }
    }
  ];
  return rows.map(function (stage) {
    const status = normalizeTaskStatus(stage.result?.status);
    return {
      capture_run_id: captureRunId,
      market_date: marketDate,
      task_kind: stage.task_kind,
      task_version: stage.task_version,
      status,
      attempt: 1,
      failure_code: status === "failed" ? "task_failed" : null,
      details: stage.details,
      created_at: new Date(createdAt).toISOString()
    };
  });
}

async function persistResearchTaskRuns(config, rows, requestImpl = requestSupabase) {
  if (!Array.isArray(rows) || !rows.length) return { written: 0, version: RESEARCH_TASK_RUN_VERSION };
  const saved = await requestImpl(config, "/rest/v1/research_task_runs?on_conflict=capture_run_id,task_kind,attempt", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: rows
  });
  return { written: Array.isArray(saved) ? saved.length : 0, version: RESEARCH_TASK_RUN_VERSION };
}

function normalizeResearchTaskRunLimit(value) {
  const limit = Number(value) || 20;
  return Math.max(1, Math.min(50, Math.round(limit)));
}

async function getResearchTaskRuns(options = {}, config = getSupabaseConfig(), requestImpl = requestSupabase) {
  const limit = normalizeResearchTaskRunLimit(options.limit);
  const columns = "task_kind,task_version,market_date,status,attempt,failure_code,details,created_at";
  const rows = await requestImpl(config, "/rest/v1/research_task_runs?select=" + columns + "&order=created_at.desc&limit=" + limit);
  return { version: RESEARCH_TASK_RUN_VERSION, count: Array.isArray(rows) ? rows.length : 0, runs: Array.isArray(rows) ? rows : [] };
}

module.exports = {
  RESEARCH_TASK_RUN_VERSION,
  TASK_KINDS,
  buildResearchTaskRunRows,
  getResearchTaskRuns,
  normalizeResearchTaskRunLimit,
  normalizeTaskStatus,
  persistResearchTaskRuns
};
