const { getDailyResearchReports } = require("./daily-research-reports");
const { getSupabaseConfig, requestSupabase } = require("./supabase-server");
const { normalizeDate } = require("./market-calendar");

const WEEKLY_RESEARCH_REPORT_VERSION = "weekly-research-report-v1";
const FROZEN_WEEKLY_REPORTS_TABLE = "frozen_weekly_research_reports";

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

function shiftDate(value, days) {
  const date = new Date(normalizeDate(value) + "T12:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function expectedBusinessDatesForWeek(weekStart) {
  const start = weekStartForDate(weekStart);
  return [0, 1, 2, 3, 4].map(function (offset) { return shiftDate(start, offset); });
}

function latestDailyReportsByDate(rows, expectedDates) {
  const allowed = new Set(expectedDates || []);
  const byDate = new Map();
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    const date = String(row?.market_date || "");
    if (!allowed.has(date) || !row?.report || typeof row.report !== "object") return;
    const prior = byDate.get(date);
    if (!prior || String(row.created_at || "") > String(prior.created_at || "")) byDate.set(date, row);
  });
  return byDate;
}

function assessWeeklyFreezeEligibility(weekStart, rows, asOfDate) {
  const normalizedWeekStart = weekStartForDate(weekStart);
  const expectedDates = expectedBusinessDatesForWeek(normalizedWeekStart);
  const completedWeekEnd = expectedDates[expectedDates.length - 1];
  const asOf = normalizeDate(asOfDate || completedWeekEnd);
  const reportsByDate = latestDailyReportsByDate(rows, expectedDates);
  const missingDates = expectedDates.filter(function (date) { return !reportsByDate.has(date); });
  if (asOf < completedWeekEnd) {
    return { eligible: false, reason: "week_not_complete", weekStart: normalizedWeekStart, expectedDates, missingDates };
  }
  if (missingDates.length) {
    return { eligible: false, reason: "incomplete_business_week", weekStart: normalizedWeekStart, expectedDates, missingDates };
  }
  return {
    eligible: true,
    reason: null,
    weekStart: normalizedWeekStart,
    expectedDates,
    missingDates: [],
    reports: expectedDates.map(function (date) { return reportsByDate.get(date); })
  };
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

function buildFrozenWeeklyResearchReport(eligibility, frozenAt) {
  if (!eligibility?.eligible) throw new Error("A complete Monday-to-Friday daily report set is required to freeze a weekly report");
  const report = buildWeeklyResearchReport(eligibility.reports);
  return {
    ...report,
    coverage: {
      ...report.coverage,
      status: "frozen_complete",
      expectedBusinessDates: eligibility.expectedDates
    },
    freeze: {
      frozenAt: new Date(frozenAt || new Date()).toISOString(),
      rule: "complete_monday_to_friday_archived_daily_reports_v1"
    }
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
  const effectiveConfig = config || getSupabaseConfig();
  const request = requestImpl || requestSupabase;
  const [daily, frozenRows] = await Promise.all([
    getDailyResearchReports({ limit: 30 }, effectiveConfig, request),
    request(effectiveConfig, "/rest/v1/" + FROZEN_WEEKLY_REPORTS_TABLE + "?select=week_start,report_version,report,frozen_at,created_at&order=week_start.desc&limit=" + limit)
  ]);
  const frozenByWeek = new Map((Array.isArray(frozenRows) ? frozenRows : []).map(function (row) {
    return [row.week_start, { weekStart: row.week_start, report: row.report, frozenAt: row.frozen_at, archived: true }];
  }));
  const dynamic = groupRowsByWeek(daily.reports).map(function ([weekStart, rows]) {
    return { weekStart, report: buildWeeklyResearchReport(rows), archived: false };
  });
  dynamic.forEach(function (row) { if (!frozenByWeek.has(row.weekStart)) frozenByWeek.set(row.weekStart, row); });
  const reports = Array.from(frozenByWeek.values()).sort(function (left, right) {
    return String(right.weekStart).localeCompare(String(left.weekStart));
  }).slice(0, limit);
  return { reportVersion: WEEKLY_RESEARCH_REPORT_VERSION, count: reports.length, reports };
}

async function freezeWeeklyResearchReport(options = {}, config = getSupabaseConfig(), requestImpl = requestSupabase) {
  const asOfDate = normalizeDate(options.asOfDate);
  const weekStart = weekStartForDate(options.weekStart || asOfDate);
  const expectedDates = expectedBusinessDatesForWeek(weekStart);
  const daily = await getDailyResearchReports({ startDate: expectedDates[0], endDate: expectedDates[4], limit: 30 }, config, requestImpl);
  const eligibility = assessWeeklyFreezeEligibility(weekStart, daily.reports, asOfDate);
  if (!eligibility.eligible) {
    return {
      status: "skipped",
      reason: eligibility.reason,
      weekStart,
      expectedBusinessDateCount: eligibility.expectedDates.length,
      archivedDailyReportCount: eligibility.expectedDates.length - eligibility.missingDates.length
    };
  }
  const report = buildFrozenWeeklyResearchReport(eligibility, options.frozenAt);
  const rows = await requestImpl(config, "/rest/v1/" + FROZEN_WEEKLY_REPORTS_TABLE + "?on_conflict=week_start,report_version", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: {
      week_start: weekStart,
      report_version: WEEKLY_RESEARCH_REPORT_VERSION,
      report,
      frozen_at: report.freeze.frozenAt
    }
  });
  return {
    status: "succeeded",
    reason: null,
    weekStart,
    expectedBusinessDateCount: eligibility.expectedDates.length,
    archivedDailyReportCount: eligibility.reports.length,
    created: Array.isArray(rows) && rows.length > 0
  };
}

module.exports = {
  WEEKLY_RESEARCH_REPORT_VERSION,
  assessWeeklyFreezeEligibility,
  buildWeeklyResearchReport,
  buildFrozenWeeklyResearchReport,
  expectedBusinessDatesForWeek,
  freezeWeeklyResearchReport,
  getWeeklyResearchReports,
  latestDailyReportsByDate,
  normalizeWeeklyReportLimit,
  weekStartForDate
};
