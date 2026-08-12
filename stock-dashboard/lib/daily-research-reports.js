const { getSupabaseConfig, requestSupabase } = require("./supabase-server");
const { normalizeDate } = require("./market-calendar");

const DAILY_RESEARCH_REPORT_VERSION = "daily-research-report-v1";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildDailyResearchReport(snapshot, packet) {
  if (!snapshot?.id) throw new Error("Research snapshot id is required");
  const marketDate = normalizeDate(snapshot.market_date || packet?.asOf?.marketDate);
  const state = packet?.marketState || {};
  const summary = snapshot.source_summary || {};
  return {
    reportVersion: DAILY_RESEARCH_REPORT_VERSION,
    marketDate,
    kind: "deterministic_fact_recap",
    market: {
      symbol: state.symbol || "QQQ",
      adjustedClose: finite(state.adjustedClose),
      changePercent: finite(state.changePercent),
      volatilityLevel: state.volatilityLevel || "unknown"
    },
    evidence: {
      eventCount: Number(summary.eventCount) || 0,
      eventTypes: summary.eventTypes || {},
      reviewStatuses: summary.reviewStatuses || {},
      providers: summary.providers || {},
      similarDayCandidateCount: Number(summary.similarDayCandidateCount) || 0
    },
    limitations: [
      "Generated deterministically from an immutable research input snapshot.",
      "Does not contain a forecast, recommendation, target price, allocation, or trade instruction.",
      "Model narrative, if any, remains separately audited and must be viewed through research replay."
    ]
  };
}

async function persistDailyResearchReport(config, snapshot, packet, requestImpl = requestSupabase) {
  const report = buildDailyResearchReport(snapshot, packet);
  const rows = await requestImpl(config, "/rest/v1/daily_research_reports?on_conflict=snapshot_id,report_version", {
    method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: { snapshot_id: snapshot.id, market_date: report.marketDate, report_version: DAILY_RESEARCH_REPORT_VERSION, report }
  });
  return { created: Array.isArray(rows) && rows.length > 0, marketDate: report.marketDate, reportVersion: DAILY_RESEARCH_REPORT_VERSION };
}

function normalizeDailyReportLimit(value) { const limit = Number(value) || 12; return Math.max(1, Math.min(30, Math.round(limit))); }

async function getDailyResearchReports(options = {}, config = getSupabaseConfig(), requestImpl = requestSupabase) {
  const rows = await requestImpl(config, "/rest/v1/daily_research_reports?select=market_date,report_version,report,created_at&order=market_date.desc,created_at.desc&limit=" + normalizeDailyReportLimit(options.limit));
  return { reportVersion: DAILY_RESEARCH_REPORT_VERSION, count: Array.isArray(rows) ? rows.length : 0, reports: Array.isArray(rows) ? rows : [] };
}

module.exports = { DAILY_RESEARCH_REPORT_VERSION, buildDailyResearchReport, getDailyResearchReports, normalizeDailyReportLimit, persistDailyResearchReport };
