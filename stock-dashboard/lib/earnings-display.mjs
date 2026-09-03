export const EARNINGS_VIEW_MODES = new Set(["upcoming", "reported"]);

export function normalizeEarningsViewMode(value) {
  return EARNINGS_VIEW_MODES.has(value) ? value : "upcoming";
}

export function shiftCalendarDate(date, offset) {
  const parsed = new Date(String(date || "") + "T12:00:00.000Z");
  if (!Number.isFinite(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + Number(offset || 0));
  return parsed.toISOString().slice(0, 10);
}

export function getEarningsViewRange(today, mode) {
  const normalizedMode = normalizeEarningsViewMode(mode);
  const normalizedToday = shiftCalendarDate(today, 0);
  if (!normalizedToday) return null;
  return normalizedMode === "reported"
    ? { startDate: shiftCalendarDate(normalizedToday, -30), endDate: normalizedToday }
    : { startDate: normalizedToday, endDate: shiftCalendarDate(normalizedToday, 30) };
}

export function selectEarningsForView(events, mode, limit = 8) {
  const normalizedMode = normalizeEarningsViewMode(mode);
  const rows = Array.isArray(events) ? events.filter(function (event) {
    return event && typeof event === "object" && /^\d{4}-\d{2}-\d{2}$/.test(String(event.marketDate || ""));
  }) : [];
  const visible = normalizedMode === "reported"
    ? rows.filter(function (event) { return event.status === "reported"; }).sort(function (left, right) {
      return String(right.marketDate).localeCompare(String(left.marketDate));
    })
    : rows.sort(function (left, right) {
      return String(left.marketDate).localeCompare(String(right.marketDate));
    });
  const boundedLimit = Number.isInteger(limit) && limit > 0 ? limit : 8;
  return visible.slice(0, boundedLimit);
}

export function getEarningsTimingPresentation(event) {
  const sourcePublishedAt = event?.source?.publishedAt;
  const scheduledAt = event?.scheduledAt;
  const hasExactPublishedAt = Number.isFinite(new Date(sourcePublishedAt || "").getTime());
  const hasExactScheduledAt = Number.isFinite(new Date(scheduledAt || "").getTime());
  if (event?.status === "reported" && hasExactPublishedAt) {
    return { kind: "published_at", value: new Date(sourcePublishedAt).toISOString() };
  }
  if (hasExactScheduledAt) return { kind: "scheduled_at", value: new Date(scheduledAt).toISOString() };
  return { kind: "session", value: String(event?.session || "unknown") };
}

export function getEarningsViewCopy(mode) {
  return normalizeEarningsViewMode(mode) === "reported"
    ? {
      label: "最近已公布",
      loadingHint: "正在读取最近 30 天已归档的公司官方结果事项…",
      emptyTitle: "最近 30 天暂无已归档结果",
      emptyBody: "这只表示当前库中没有通过人工核对并归档的已公布财报，不代表市场没有公司已经披露结果。",
      hintSuffix: "项已归档结果；结果记录不自动解释涨跌或构成交易结论。"
    }
    : {
      label: "即将公布",
      loadingHint: "正在读取未来 30 天已审核归档的公司官方财报事项…",
      emptyTitle: "未来 30 天暂无已核对事项",
      emptyBody: "这只表示当前库中没有通过人工核对并归档的官方财报候选，不代表市场没有公司将披露财报。",
      hintSuffix: "项已审核公司官方事项；计划日期不等于业绩结果或交易结论。"
    };
}
