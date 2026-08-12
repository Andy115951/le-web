const { getDailyResearchReports } = require("./daily-research-reports");
const { getEventReviewQueue } = require("./event-review");
const { getResearchHealth } = require("./research-health");
const { getResearchTaskRuns } = require("./research-task-runs");
const { getSupabaseConfig } = require("./supabase-server");
const { getWeeklyResearchReports } = require("./weekly-research-reports");

const RESEARCH_QUALITY_VERSION = "research-quality-v1";

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0;
}

function latestStagesByKind(runs) {
  const stages = {};
  (Array.isArray(runs) ? runs : []).forEach(function (run) {
    const kind = String(run?.task_kind || "").trim();
    if (!kind || stages[kind]) return;
    stages[kind] = {
      status: String(run.status || "unknown"),
      marketDate: run.market_date || null,
      taskVersion: run.task_version || null,
      createdAt: run.created_at || null
    };
  });
  return stages;
}

function buildResearchQualitySummary(input) {
  const health = input?.health || {};
  const daily = input?.daily || {};
  const weekly = input?.weekly || {};
  const review = input?.review || {};
  const tasks = input?.tasks || {};
  const snapshotCount = finiteNonNegative(health.snapshotCount);
  const matureOutcomeCount = finiteNonNegative(health.matureOutcomeCount);
  const dailyReportCount = finiteNonNegative(daily.count);
  const weeklyReportCount = finiteNonNegative(weekly.count);
  const reviewBacklog = finiteNonNegative(review.needsAttentionCount);
  const taskRunCount = finiteNonNegative(tasks.count);
  const limitations = [
    "Coverage counts describe archived research artifacts, not the completeness or correctness of the market record.",
    "Pending review items require a human evidence check; this panel does not accept or reject attributions.",
    "This is research observability only and does not provide a forecast, recommendation, target price, allocation, or trade instruction."
  ];
  if (!snapshotCount) limitations.push("No archived research snapshot is available yet; wait for a successful market-close capture before evaluating coverage.");
  if (snapshotCount > matureOutcomeCount) limitations.push("Some snapshots are still inside the 20-trading-day outcome window and cannot yet be evaluated.");
  if (!taskRunCount) limitations.push("The task ledger will begin filling after the next full market-close capture; historical runs are not synthesized.");

  return {
    version: RESEARCH_QUALITY_VERSION,
    coverage: {
      researchSnapshots: snapshotCount,
      dailyFactReports: dailyReportCount,
      weeklyFactReports: weeklyReportCount,
      matureOutcomeEvaluations: matureOutcomeCount,
      pendingOutcomeEvaluations: Math.max(0, snapshotCount - matureOutcomeCount),
      latestCaptureStatus: health.latestCapture?.status || "unknown"
    },
    review: {
      totalEvents: finiteNonNegative(review.totalCount),
      needsAttention: reviewBacklog,
      unreviewed: finiteNonNegative(review.unreviewedCount)
    },
    operations: {
      taskRunCount,
      taskLedgerState: taskRunCount ? "recording" : "awaiting_next_capture",
      latestStages: latestStagesByKind(tasks.runs)
    },
    limitations
  };
}

async function getResearchQuality(options = {}) {
  const config = options.config || getSupabaseConfig();
  const requestImpl = options.requestImpl;
  const days = options.days || 30;
  const getHealth = options.getHealth || getResearchHealth;
  const getDailyReports = options.getDailyReports || getDailyResearchReports;
  const getWeeklyReports = options.getWeeklyReports || getWeeklyResearchReports;
  const getReviewQueue = options.getReviewQueue || getEventReviewQueue;
  const getTaskRuns = options.getTaskRuns || getResearchTaskRuns;
  const [health, daily, weekly, review, tasks] = await Promise.all([
    getHealth({ config, requestImpl, env: options.env }),
    getDailyReports({ limit: 30 }, config, requestImpl),
    getWeeklyReports({ limit: 12 }, config, requestImpl),
    getReviewQueue(days),
    getTaskRuns({ limit: 50 }, config, requestImpl)
  ]);
  return buildResearchQualitySummary({ health, daily, weekly, review, tasks });
}

module.exports = {
  RESEARCH_QUALITY_VERSION,
  buildResearchQualitySummary,
  getResearchQuality,
  latestStagesByKind
};
