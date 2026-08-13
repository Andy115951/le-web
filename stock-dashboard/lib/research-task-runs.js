const { getSupabaseConfig, requestSupabase } = require("./supabase-server");
const { normalizeDate } = require("./market-calendar");
const { RESEARCH_PACKET_SNAPSHOT_VERSION } = require("./research-packet-snapshots");
const { DAILY_RESEARCH_REPORT_VERSION } = require("./daily-research-reports");
const { RESEARCH_OUTCOME_EVALUATION_VERSION } = require("./research-outcome-evaluations");
const { MARKET_ATTRIBUTION_AGENT_VERSION } = require("./market-attribution-agent");
const { EVENT_LABELER_AGENT_VERSION } = require("./event-labeler-agent");

const RESEARCH_TASK_RUN_VERSION = "research-task-run-v2";
const TASK_KINDS = new Set(["market_collection", "event_attribution", "event_labeling", "research_input_snapshot", "daily_fact_report", "weekly_fact_report", "model_recap", "outcome_evaluation"]);
const TASK_STATUSES = new Set(["succeeded", "partial", "skipped", "failed", "disabled"]);
const TASK_FAILURE_CODES = new Set(["task_failed", "retryable_task_failure"]);
const DEFAULT_MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 250;

function normalizeTaskStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return TASK_STATUSES.has(status) ? status : "skipped";
}

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0;
}

function normalizeIsoTime(value, fallback = null) {
  const parsed = new Date(value || "");
  if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  return fallback;
}

function normalizeAttempt(value, fallback) {
  const attempt = Number(value);
  return Number.isInteger(attempt) && attempt > 0 ? attempt : fallback;
}

function isRetryableResearchTaskError(error) {
  const message = String(error?.message || error || "");
  return /ECONNRESET|ECONNREFUSED|ETIMEDOUT|timeout|network|fetch failed|temporarily unavailable|\b429\b|\b50[0234]\b/i.test(message);
}

function wait(delayMs) {
  return new Promise(function (resolve) { setTimeout(resolve, delayMs); });
}

function buildTaskAttempt(input = {}) {
  const startedAt = normalizeIsoTime(input.startedAt);
  const finishedAt = normalizeIsoTime(input.finishedAt, startedAt);
  const queueDelayMs = finiteNonNegative(input.queueDelayMs);
  const startedMs = startedAt ? new Date(startedAt).getTime() : NaN;
  const finishedMs = finishedAt ? new Date(finishedAt).getTime() : NaN;
  const measuredDuration = Number.isFinite(startedMs) && Number.isFinite(finishedMs)
    ? Math.max(0, finishedMs - startedMs)
    : 0;
  const status = normalizeTaskStatus(input.status);
  return {
    status,
    failureCode: status === "failed" && TASK_FAILURE_CODES.has(input.failureCode) ? input.failureCode : status === "failed" ? "task_failed" : null,
    queuedAt: normalizeIsoTime(input.queuedAt),
    startedAt,
    finishedAt,
    queueDelayMs,
    durationMs: finiteNonNegative(input.durationMs || measuredDuration)
  };
}

async function runResearchTaskWithRetry(options = {}) {
  if (typeof options.run !== "function") throw new Error("Research task runner is required");
  const maxAttempts = Math.max(1, Math.min(3, Math.round(Number(options.maxAttempts) || DEFAULT_MAX_ATTEMPTS)));
  const queuedAt = normalizeIsoTime(options.queuedAt, new Date().toISOString());
  const retryable = options.isRetryable || isRetryableResearchTaskError;
  const waitImpl = options.wait || wait;
  const attempts = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = new Date();
    try {
      const result = await options.run({ attempt });
      const finishedAt = new Date();
      attempts.push(buildTaskAttempt({
        status: result?.status,
        queuedAt,
        startedAt,
        finishedAt,
        queueDelayMs: startedAt.getTime() - new Date(queuedAt).getTime()
      }));
      return { ...(result || {}), status: normalizeTaskStatus(result?.status), attempts };
    } catch (error) {
      const willRetry = attempt < maxAttempts && Boolean(retryable(error));
      const finishedAt = new Date();
      attempts.push(buildTaskAttempt({
        status: "failed",
        failureCode: willRetry ? "retryable_task_failure" : "task_failed",
        queuedAt,
        startedAt,
        finishedAt,
        queueDelayMs: startedAt.getTime() - new Date(queuedAt).getTime()
      }));
      if (!willRetry) return { status: "failed", error: String(error?.message || error || "Task failed"), attempts };
      await waitImpl(RETRY_DELAY_MS);
    }
  }

  return { status: "failed", error: "Task attempts exhausted", attempts };
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
      task_kind: "event_attribution",
      task_version: MARKET_ATTRIBUTION_AGENT_VERSION,
      result: stages.eventAttribution,
      details: {
        deterministicAttributions: finiteNonNegative(stages.eventAttribution?.deterministicAttributions),
        heuristicAttributionCount: finiteNonNegative(stages.eventAttribution?.heuristicAttributionCount),
        primarySourcesLinked: finiteNonNegative(stages.eventAttribution?.primarySourcesLinked),
        evidenceSourcesLinked: finiteNonNegative(stages.eventAttribution?.evidenceSourcesLinked),
        attributionsWritten: finiteNonNegative(stages.eventAttribution?.attributionsWritten)
      }
    },
    {
      task_kind: "event_labeling",
      task_version: EVENT_LABELER_AGENT_VERSION,
      result: stages.eventLabeling,
      details: {
        processedEvents: finiteNonNegative(stages.eventLabeling?.processedEvents),
        labelsWritten: finiteNonNegative(stages.eventLabeling?.labelsWritten),
        requiresReviewCount: finiteNonNegative(stages.eventLabeling?.requiresReviewCount)
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
      task_kind: "weekly_fact_report",
      task_version: "weekly-research-report-v1",
      result: stages.weeklyReport,
      details: {
        created: Boolean(stages.weeklyReport?.created),
        expectedBusinessDateCount: finiteNonNegative(stages.weeklyReport?.expectedBusinessDateCount),
        archivedDailyReportCount: finiteNonNegative(stages.weeklyReport?.archivedDailyReportCount),
        calendarStatus: ["official_full_closures", "strict_weekday_fallback"].includes(stages.weeklyReport?.calendarStatus)
          ? stages.weeklyReport.calendarStatus
          : "unknown"
      }
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
  return rows.flatMap(function (stage) {
    const stageStatus = normalizeTaskStatus(stage.result?.status);
    const attemptInputs = Array.isArray(stage.result?.attempts) && stage.result.attempts.length
      ? stage.result.attempts
      : [{ status: stageStatus, queuedAt: createdAt, startedAt: createdAt, finishedAt: createdAt, queueDelayMs: 0, durationMs: 0 }];
    return attemptInputs.map(function (input, index) {
      const attempt = buildTaskAttempt(input);
      const status = normalizeTaskStatus(attempt.status);
      return {
        capture_run_id: captureRunId,
        market_date: marketDate,
        task_kind: stage.task_kind,
        task_version: stage.task_version,
        status,
        attempt: normalizeAttempt(input?.attempt, index + 1),
        failure_code: status === "failed" ? attempt.failureCode || "task_failed" : null,
        details: stage.details,
        queued_at: attempt.queuedAt,
        started_at: attempt.startedAt,
        finished_at: attempt.finishedAt,
        queue_delay_ms: attempt.queueDelayMs,
        duration_ms: attempt.durationMs,
        created_at: attempt.finishedAt || new Date(createdAt).toISOString()
      };
    });
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
  const columns = "task_kind,task_version,market_date,status,attempt,failure_code,details,queued_at,started_at,finished_at,queue_delay_ms,duration_ms,created_at";
  const rows = await requestImpl(config, "/rest/v1/research_task_runs?select=" + columns + "&order=created_at.desc&limit=" + limit);
  return { version: RESEARCH_TASK_RUN_VERSION, count: Array.isArray(rows) ? rows.length : 0, runs: Array.isArray(rows) ? rows : [] };
}

module.exports = {
  RESEARCH_TASK_RUN_VERSION,
  RETRY_DELAY_MS,
  TASK_KINDS,
  TASK_FAILURE_CODES,
  buildTaskAttempt,
  buildResearchTaskRunRows,
  getResearchTaskRuns,
  isRetryableResearchTaskError,
  normalizeResearchTaskRunLimit,
  normalizeTaskStatus,
  persistResearchTaskRuns,
  runResearchTaskWithRetry
};
