const { getDailyResearchReports } = require("./daily-research-reports");
const { getEventReviewQueue } = require("./event-review");
const { getResearchHealth } = require("./research-health");
const { getResearchTaskRuns } = require("./research-task-runs");
const { getSupabaseConfig, requestSupabase } = require("./supabase-server");
const { getWeeklyResearchReports } = require("./weekly-research-reports");
const { getSecUserAgent } = require("./sec-edgar");
const { getFredApiKey } = require("./fred-macro");
const { getDeepSeekResearchReadiness } = require("./deepseek-research-narrative");
const { getGatewayCompatibilityConfig } = require("./model-gateway-compatibility");
const { getNdxSnapshot } = require("./ndx-snapshots");
const { getRecentCaptureRuns } = require("./market-history-capture");
const { marketDate } = require("./historical-market-data");
const { SIMILARITY_METHOD_VERSION } = require("./similar-days");

const RESEARCH_QUALITY_VERSION = "research-quality-v5";
const DERIVED_DATA_SYMBOL = "QQQ";
const NDX_FRESH_DAYS = 45;
const NDX_AGING_DAYS = 90;

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

function normalizeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.toString() : null;
  } catch (_error) {
    return null;
  }
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

function calendarDayDistance(later, earlier) {
  const toUtcDay = function (value) {
    const [year, month, day] = String(value || "").split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.floor((toUtcDay(later) - toUtcDay(earlier)) / 86400000);
}

function buildNdxConstituentFreshness(input = {}) {
  const asOfDate = normalizeMarketDate(input.asOfDate);
  const effectiveDate = normalizeMarketDate(input.effectiveDate);
  const sourceUrl = normalizeHttpsUrl(input.sourceUrl);
  const constituentCount = finiteNonNegative(input.constituentCount);
  if (!asOfDate) return { status: "awaiting_reference_date", asOfDate: null, effectiveDate, sourceUrl, ageDays: null, constituentCount };
  if (!effectiveDate) return { status: "awaiting_snapshot", asOfDate, effectiveDate: null, sourceUrl: null, ageDays: null, constituentCount: 0 };
  const ageDays = calendarDayDistance(asOfDate, effectiveDate);
  const status = ageDays < 0
    ? "inconsistent_future"
    : ageDays <= NDX_FRESH_DAYS
      ? "current"
      : ageDays <= NDX_AGING_DAYS
        ? "aging"
        : "stale";
  return { status, asOfDate, effectiveDate, sourceUrl, ageDays, constituentCount };
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
  const getGatewayCompatibility = dependencies.getGatewayCompatibility || getGatewayCompatibilityConfig;
  const model = getModelReadiness(env) || {};
  const compatibility = getGatewayCompatibility(env) || {};
  const compatibilityStatus = compatibility.enabled ? "ready" : (compatibility.reason === "disabled" ? "disabled" : "needs_configuration");
  return {
    marketCollection: { status: "ready", kind: "built_in" },
    earningsCalendar: { status: "awaiting_import", kind: "official_company_ir_calendar" },
    secFilings: { status: readinessStatus(getSecConfig, env), kind: "official_company_filings" },
    fredMacro: { status: readinessStatus(getFredConfig, env), kind: "official_macro_observations" },
    modelNarrative: { status: ["ready", "disabled", "data_approval_required", "needs_configuration"].includes(model.status) ? model.status : "needs_configuration", kind: "optional_research_recap" },
    modelGatewayCompatibility: { status: compatibilityStatus, kind: "no_project_data_probe" }
  };
}

function hasExactTimestamp(value) {
  return Number.isFinite(new Date(value || "").getTime());
}

function buildEarningsCalendarReadiness(rows) {
  const events = Array.isArray(rows) ? rows : [];
  const reportedCount = events.filter(function (row) {
    return String(row?.event_status || "").trim().toLowerCase() === "reported";
  }).length;
  const featureEligibleCount = events.filter(function (row) {
    return String(row?.event_status || "").trim().toLowerCase() === "reported"
      && hasExactTimestamp(row?.sources?.published_at);
  }).length;
  const status = featureEligibleCount > 0
    ? "ready"
    : events.length > 0
      ? "calendar_only"
      : "awaiting_import";
  return {
    status,
    calendarEventCount: events.length,
    reportedCount,
    featureEligibleCount,
    kind: "official_company_ir_calendar"
  };
}

function captureStageStatus(value) {
  return ["pending", "running", "succeeded", "partial", "skipped", "failed", "disabled"].includes(value) ? value : "unknown";
}

function buildCaptureInputFreshness(runs) {
  const latest = Array.isArray(runs) ? runs[0] : null;
  const details = latest?.details && typeof latest.details === "object" ? latest.details : {};
  if (!latest) {
    return {
      status: "awaiting_capture",
      marketDate: null,
      finishedAt: null,
      priceHistory: "unknown",
      secFilings: "unknown",
      fredMacro: "unknown"
    };
  }
  return {
    status: captureStageStatus(latest.status),
    marketDate: normalizeMarketDate(latest.market_date),
    finishedAt: hasExactTimestamp(latest.finished_at) ? new Date(latest.finished_at).toISOString() : null,
    priceHistory: captureStageStatus(details.priceHistoryStatus || details.price_history_status),
    secFilings: captureStageStatus(details.secFilingStatus || details.sec_filing_status),
    fredMacro: captureStageStatus(details.fredMacroStatus || details.fred_macro_status)
  };
}

function buildResearchQualityNextSteps(input = {}) {
  const captureInputs = input.captureInputs || {};
  const derivedData = input.derivedData || {};
  const ndxConstituents = input.ndxConstituents || {};
  const earningsCalendar = input.earningsCalendar || {};
  const review = input.review || {};
  const steps = [];
  const captureFailed = captureInputs.status === "failed"
    || [captureInputs.priceHistory, captureInputs.secFilings, captureInputs.fredMacro].includes("failed");

  if (captureFailed) {
    steps.push({ id: "review_latest_capture", kind: "protected_diagnostics" });
  }

  const hasMarketDate = Boolean(normalizeMarketDate(derivedData.latestMarketDate));
  const derivedBehind = [
    derivedData.dailyFeatures?.status,
    derivedData.forwardLabels?.status,
    derivedData.similarDays?.status
  ].some(function (status) {
    return ["stale", "not_materialized", "not_observed", "inconsistent_future"].includes(status);
  });
  if (hasMarketDate && derivedBehind) {
    // The panel may only suggest the dry-run. Writing always remains an explicit terminal action.
    steps.push({ id: "preview_derived_rebuild", kind: "preview_only" });
  }

  if (["aging", "stale", "inconsistent_future", "awaiting_snapshot"].includes(ndxConstituents.status)) {
    steps.push({ id: "review_ndx_official_snapshot", kind: "official_evidence" });
  }

  if (["awaiting_import", "calendar_only", "needs_database_setup"].includes(earningsCalendar.status)) {
    steps.push({ id: "review_earnings_calendar", kind: "official_evidence" });
  }

  if (finiteNonNegative(review.needsAttentionCount) > 0) {
    steps.push({ id: "review_event_evidence", kind: "human_review" });
  }

  return steps;
}

async function getCaptureInputFreshness(config = getSupabaseConfig(), requestImpl = requestSupabase, getRuns = getRecentCaptureRuns) {
  try {
    // The coverage panel needs factual stage states, never operational diagnostics.
    const runs = await getRuns({ limit: 1, safeSummary: true }, config, requestImpl);
    return buildCaptureInputFreshness(runs);
  } catch (_error) {
    return {
      status: "unavailable",
      marketDate: null,
      finishedAt: null,
      priceHistory: "unknown",
      secFilings: "unknown",
      fredMacro: "unknown"
    };
  }
}

async function getEarningsCalendarReadiness(config = getSupabaseConfig(), requestImpl = requestSupabase) {
  try {
    const rows = await requestImpl(config, "/rest/v1/earnings_events?select=event_status,sources(published_at)&order=market_date.desc&limit=250");
    return buildEarningsCalendarReadiness(rows);
  } catch (_error) {
    // Keep the quality panel usable when a deployment has not applied the calendar migration yet.
    return { status: "needs_database_setup", calendarEventCount: 0, reportedCount: 0, featureEligibleCount: 0, kind: "official_company_ir_calendar" };
  }
}

function buildResearchQualitySummary(input) {
  const health = input?.health || {};
  const daily = input?.daily || {};
  const weekly = input?.weekly || {};
  const review = input?.review || {};
  const tasks = input?.tasks || {};
  const integrations = input?.integrations || {};
  const derivedData = input?.derivedData || buildDerivedDataFreshness({});
  const ndxConstituents = input?.ndxConstituents || buildNdxConstituentFreshness({});
  const captureInputs = input?.captureInputs || buildCaptureInputFreshness([]);
  const nextSteps = buildResearchQualityNextSteps({
    captureInputs,
    derivedData,
    ndxConstituents,
    earningsCalendar: integrations.earningsCalendar,
    review
  });
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
  if (["aging", "stale"].includes(ndxConstituents.status)) limitations.push("The NDX constituent snapshot needs an official-source review before it is treated as current coverage.");
  if (captureInputs.status === "failed" || [captureInputs.priceHistory, captureInputs.secFilings, captureInputs.fredMacro].includes("failed")) limitations.push("The latest capture has at least one failed factual input stage; use protected run diagnostics before a manual retry.");

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
    captureInputs,
    derivedData,
    ndxConstituents,
    nextSteps,
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
  const getEarningsReadiness = options.getEarningsReadiness || getEarningsCalendarReadiness;
  const getDerivedFreshness = options.getDerivedFreshness || getDerivedDataFreshness;
  const getNdx = options.getNdxSnapshot || getNdxSnapshot;
  const getCaptureFreshness = options.getCaptureFreshness || getCaptureInputFreshness;
  const now = options.now instanceof Date ? options.now : new Date();
  const asOfDate = normalizeMarketDate(options.asOfDate) || marketDate(now.getTime());
  const [health, daily, weekly, review, tasks, derivedData, ndxSnapshot, earningsCalendar, captureInputs] = await Promise.all([
    getHealth({ config, requestImpl, env: options.env }),
    getDailyReports({ limit: 30 }, config, requestImpl),
    getWeeklyReports({ limit: 12 }, config, requestImpl),
    getReviewQueue(days),
    getTaskRuns({ limit: 50 }, config, requestImpl),
    getDerivedFreshness(config, requestImpl),
    getNdx(asOfDate, config, requestImpl),
    getEarningsReadiness(config, requestImpl),
    getCaptureFreshness(config, requestImpl, options.getCaptureRuns || getRecentCaptureRuns)
  ]);
  return buildResearchQualitySummary({
    health,
    daily,
    weekly,
    review,
    tasks,
    derivedData,
    captureInputs,
    ndxConstituents: buildNdxConstituentFreshness({
      asOfDate,
      effectiveDate: ndxSnapshot?.effective_date,
      sourceUrl: ndxSnapshot?.source_url,
      constituentCount: ndxSnapshot?.constituent_count
    }),
    integrations: {
      ...getIntegrationReadiness(options.env || process.env),
      earningsCalendar
    }
  });
}

module.exports = {
  RESEARCH_QUALITY_VERSION,
  NDX_AGING_DAYS,
  NDX_FRESH_DAYS,
  buildNdxConstituentFreshness,
  buildDerivedDataFreshness,
  buildCaptureInputFreshness,
  buildResearchQualityNextSteps,
  buildEarningsCalendarReadiness,
  buildResearchIntegrationReadiness,
  freshnessStatus,
  getDerivedDataFreshness,
  getCaptureInputFreshness,
  getEarningsCalendarReadiness,
  buildResearchQualitySummary,
  getResearchQuality,
  latestStagesByKind
};
