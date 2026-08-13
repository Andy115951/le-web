const { getDailyResearchReports } = require("./daily-research-reports");
const { getEventReviewQueue } = require("./event-review");
const { getResearchHealth } = require("./research-health");
const { getResearchTaskRuns } = require("./research-task-runs");
const { getSupabaseConfig, requestSupabase } = require("./supabase-server");
const { getWeeklyResearchReports } = require("./weekly-research-reports");
const { getSecUserAgent } = require("./sec-edgar");
const { getFredApiKey } = require("./fred-macro");
const { getDeepSeekResearchReadiness } = require("./deepseek-research-narrative");
const { SIMILARITY_METHOD_VERSION } = require("./similar-days");

const RESEARCH_QUALITY_VERSION = "research-quality-v2";
const DERIVED_DATA_SYMBOL = "QQQ";

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

function readinessStatus(getConfig, env) {
  try {
    getConfig(env);
    return "ready";
  } catch (_error) {
    return "needs_configuration";
  }
}

function normalizeMarketDate(value) {
  const date = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function freshnessStatus(sourceMarketDate, artifactMarketDate, missingStatus = "not_materialized") {
  if (!sourceMarketDate) return "awaiting_market_data";
  if (!artifactMarketDate) return missingStatus;
  if (artifactMarketDate === sourceMarketDate) return "current";
  if (artifactMarketDate < sourceMarketDate) return "stale";
  return "inconsistent_future";
}

function buildDerivedDataFreshness(input = {}) {
  const latestMarketDate = normalizeMarketDate(input.latestMarketDate);
  const featureDate = normalizeMarketDate(input.featureDate);
  const labelDate = normalizeMarketDate(input.labelDate);
  const similarDate = normalizeMarketDate(input.similarDate);
  return {
    symbol: DERIVED_DATA_SYMBOL,
    latestMarketDate,
    dailyFeatures: {
      latestMarketDate: featureDate,
      status: freshnessStatus(latestMarketDate, featureDate)
    },
    forwardLabels: {
      latestMarketDate: labelDate,
      status: freshnessStatus(latestMarketDate, labelDate)
    },
    similarDays: {
      latestTargetMarketDate: similarDate,
      status: freshnessStatus(latestMarketDate, similarDate, "not_observed")
    }
  };
}

async function getDerivedDataFreshness(config = getSupabaseConfig(), requestImpl = requestSupabase) {
  const instruments = await requestImpl(config, "/rest/v1/instruments?select=id,symbol&symbol=eq." + DERIVED_DATA_SYMBOL + "&limit=1");
  const instrument = Array.isArray(instruments) ? instruments[0] : null;
  if (!instrument?.id) return buildDerivedDataFreshness({});
  const instrumentId = encodeURIComponent(instrument.id);
  const [prices, features, labels, similar] = await Promise.all([
    requestImpl(config, "/rest/v1/price_bars_daily?select=market_date&instrument_id=eq." + instrumentId + "&order=market_date.desc&limit=1"),
    requestImpl(config, "/rest/v1/daily_market_features?select=market_date&instrument_id=eq." + instrumentId + "&order=market_date.desc&limit=1"),
    requestImpl(config, "/rest/v1/market_forward_labels?select=market_date&instrument_id=eq." + instrumentId + "&order=market_date.desc&limit=1"),
    requestImpl(config, "/rest/v1/similar_day_matches?select=target_market_date&target_instrument_id=eq." + instrumentId + "&method_version=eq." + encodeURIComponent(SIMILARITY_METHOD_VERSION) + "&order=target_market_date.desc&limit=1")
  ]);
  return buildDerivedDataFreshness({
    latestMarketDate: Array.isArray(prices) ? prices[0]?.market_date : null,
    featureDate: Array.isArray(features) ? features[0]?.market_date : null,
    labelDate: Array.isArray(labels) ? labels[0]?.market_date : null,
    similarDate: Array.isArray(similar) ? similar[0]?.target_market_date : null
  });
}

function buildResearchIntegrationReadiness(env = process.env, dependencies = {}) {
  const getSecConfig = dependencies.getSecConfig || getSecUserAgent;
  const getFredConfig = dependencies.getFredConfig || getFredApiKey;
  const getModelReadiness = dependencies.getModelReadiness || getDeepSeekResearchReadiness;
  const model = getModelReadiness(env) || {};
  return {
    marketCollection: { status: "ready", kind: "built_in" },
    secFilings: { status: readinessStatus(getSecConfig, env), kind: "official_company_filings" },
    fredMacro: { status: readinessStatus(getFredConfig, env), kind: "official_macro_observations" },
    modelNarrative: { status: ["ready", "disabled", "data_approval_required", "needs_configuration"].includes(model.status) ? model.status : "needs_configuration", kind: "optional_research_recap" }
  };
}

function buildResearchQualitySummary(input) {
  const health = input?.health || {};
  const daily = input?.daily || {};
  const weekly = input?.weekly || {};
  const review = input?.review || {};
  const tasks = input?.tasks || {};
  const integrations = input?.integrations || {};
  const derivedData = input?.derivedData || buildDerivedDataFreshness({});
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
    integrations,
    derivedData,
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
  const getIntegrationReadiness = options.getIntegrationReadiness || buildResearchIntegrationReadiness;
  const getDerivedFreshness = options.getDerivedFreshness || getDerivedDataFreshness;
  const [health, daily, weekly, review, tasks, derivedData] = await Promise.all([
    getHealth({ config, requestImpl, env: options.env }),
    getDailyReports({ limit: 30 }, config, requestImpl),
    getWeeklyReports({ limit: 12 }, config, requestImpl),
    getReviewQueue(days),
    getTaskRuns({ limit: 50 }, config, requestImpl),
    getDerivedFreshness(config, requestImpl)
  ]);
  return buildResearchQualitySummary({ health, daily, weekly, review, tasks, derivedData, integrations: getIntegrationReadiness(options.env || process.env) });
}

module.exports = {
  RESEARCH_QUALITY_VERSION,
  buildDerivedDataFreshness,
  buildResearchIntegrationReadiness,
  freshnessStatus,
  getDerivedDataFreshness,
  buildResearchQualitySummary,
  getResearchQuality,
  latestStagesByKind
};
