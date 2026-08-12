const { getDailyResearchReports } = require("./daily-research-reports");
const { normalizeDate } = require("./market-calendar");

const WEEKLY_RESEARCH_REPORT_VERSION = "weekly-research-report-v1";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function percentageChange(start, end) {
  if (start === null || end === null || start === 0) return null;
  return Math.round(((end / start - 1) * 100) * 1000000) / 1000000;
}

function addCounts(target, values) {
  Object.entries(values || {}).forEach(function ([key, value]) {
    const count = finite(value);
    if (count !== null) target[key] = (target[key] || 0) + count;
  });
  return target;
}

function weekStartForDate(value) {
  const date = normalizeDate(value);
  const utc = new Date(date + "T00:00:00Z");
  const mondayOffset = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - mondayOffset);
  return utc.toISOString().slice(0, 10);
}

function buildWeeklyResearchReport(rows) {
  const reports = (Array.isArray(rows) ? rows : []).filter(function (row) {
    return row?.report && typeof row.report === "object" && row.market_date;
  }).slice().sort(function (left, right) {
    return String(left.market_date).localeCompare(String(right.market_date));
  });
  if (!reports.length) throw new Error("At least one daily research report is required");

  const first = reports[0];
  const last = reports[reports.length - 1];
  const firstClose = finite(first.report?.market?.adjustedClose);
  const lastClose = finite(last.report?.market?.adjustedClose);
  const evidence = { eventCount: 0, similarDayCandidateCount: 0, eventTypes: {}, reviewStatuses: {}, providers: {} };
  reports.forEach(function (row) {
    const dailyEvidence = row.report?.evidence || {};
    evidence.eventCount += finite(dailyEvidence.eventCount) || 0;
    evidence.similarDayCandidateCount += finite(dailyEvidence.similarDayCandidateCount) || 0;
    addCounts(evidence.eventTypes, dailyEvidence.eventTypes);
    addCounts(evidence.reviewStatuses, dailyEvidence.reviewStatuses);
    addCounts(evidence.providers, dailyEvidence.providers);
  });

  return {
    reportVersion: WEEKLY_RESEARCH_REPORT_VERSION,
    kind: "deterministic_weekly_fact_recap",
    weekStart: weekStartForDate(first.market_date),
    observedStart: normalizeDate(first.market_date),
    observedEnd: normalizeDate(last.market_date),
    coverage: {
      archivedDailyReports: reports.length,
      status: reports.length >= 3 ? "substantial" : "limited"
    },
    market: {
      symbol: last.report?.market?.symbol || "QQQ",
      observedStartClose: firstClose,
      observedEndClose: lastClose,
      observedWindowChangePercent: first.market_date !== last.market_date
        ? percentageChange(firstClose, lastClose)
        : null,
      latestVolatilityLevel: last.report?.market?.volatilityLevel || "unknown"
    },
    evidence,
    limitations: [
      "Aggregates only immutable daily fact reports already archived for the displayed week.",
      "Coverage reflects available archived report dates; it does not infer holidays, missing sessions, or unrecorded evidence.",
      "Does not contain a forecast, recommendation, target price, allocation, or trade instruction."
    ]
  };
}

function normalizeWeeklyReportLimit(value) {
  const limit = Number(value) || 8;
  return Math.max(1, Math.min(12, Math.round(limit)));
}

function groupRowsByWeek(rows) {
  const groups = new Map();
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    if (!row?.market_date) return;
    const weekStart = weekStartForDate(row.market_date);
    const group = groups.get(weekStart) || [];
    group.push(row);
    groups.set(weekStart, group);
  });
  return Array.from(groups.entries()).sort(function ([left], [right]) { return right.localeCompare(left); });
}

async function getWeeklyResearchReports(options = {}, config, requestImpl) {
  const limit = normalizeWeeklyReportLimit(options.limit);
  const daily = await getDailyResearchReports({ limit: 30 }, config, requestImpl);
  const reports = groupRowsByWeek(daily.reports).slice(0, limit).map(function ([weekStart, rows]) {
    return { weekStart, report: buildWeeklyResearchReport(rows) };
  });
  return { reportVersion: WEEKLY_RESEARCH_REPORT_VERSION, count: reports.length, reports };
}

module.exports = {
  WEEKLY_RESEARCH_REPORT_VERSION,
  buildWeeklyResearchReport,
  getWeeklyResearchReports,
  normalizeWeeklyReportLimit,
  weekStartForDate
};
