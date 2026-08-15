export const PERSONAL_OBSERVATION_VERSION = "personal-observation-v1";
export const PERSONAL_OBSERVATION_RETENTION_DAYS = 90;
export const PERSONAL_OBSERVATION_KINDS = new Set(["drawdown_rule", "target_hit", "target_near", "relative_weakness", "daily_drop"]);

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 3) {
  const number = finite(value);
  return number === null ? null : Number(number.toFixed(digits));
}

function validMarketDate(value) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(date + "T12:00:00.000Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}

function validTimestamp(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp).toISOString() : null;
}

function normalizeRules(rules) {
  const unique = new Map();
  (Array.isArray(rules) ? rules : []).forEach(function (rule) {
    const drawdown = finite(rule?.drawdown);
    const sellPercent = finite(rule?.sellPercent);
    if (drawdown === null || sellPercent === null || drawdown <= 0 || sellPercent <= 0) return;
    unique.set(drawdown, { drawdown: round(drawdown, 2), sellPercent: round(sellPercent, 2) });
  });
  return Array.from(unique.values()).sort(function (left, right) { return left.drawdown - right.drawdown; });
}

function createObservation(input) {
  const marketDate = validMarketDate(input.marketDate);
  const symbol = String(input.symbol || "").trim().toUpperCase();
  const kind = String(input.kind || "").trim();
  const capturedAt = validTimestamp(input.capturedAt);
  if (!marketDate || !symbol || !PERSONAL_OBSERVATION_KINDS.has(kind) || !capturedAt) return null;
  const discriminator = String(input.discriminator || "default").trim().slice(0, 48) || "default";
  const generatedId = marketDate + ":" + symbol + ":" + kind + ":" + discriminator;
  const id = String(input.id || generatedId).trim().slice(0, 200) || generatedId;
  return {
    id,
    version: PERSONAL_OBSERVATION_VERSION,
    marketDate,
    capturedAt,
    symbol,
    displayName: String(input.displayName || symbol).trim().slice(0, 120) || symbol,
    kind,
    priority: Math.max(1, Math.min(100, Math.round(finite(input.priority) || 1))),
    title: String(input.title || "观察事件").trim().slice(0, 120),
    detail: String(input.detail || "触发了已配置的观察条件，仍需结合来源与个人计划复核。").trim().slice(0, 360),
    metrics: input.metrics && typeof input.metrics === "object" && !Array.isArray(input.metrics) ? input.metrics : {}
  };
}

export function normalizePersonalObservations(observations, now = Date.now()) {
  const cutoff = now - PERSONAL_OBSERVATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const latest = new Map();
  (Array.isArray(observations) ? observations : []).forEach(function (entry) {
    const normalized = createObservation(entry);
    if (!normalized || new Date(normalized.capturedAt).getTime() < cutoff) return;
    const current = latest.get(normalized.id);
    if (!current || new Date(normalized.capturedAt).getTime() > new Date(current.capturedAt).getTime()) latest.set(normalized.id, normalized);
  });
  return Array.from(latest.values()).sort(function (left, right) {
    return new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime() || right.priority - left.priority || left.id.localeCompare(right.id);
  }).slice(0, 500);
}

export function mergePersonalObservations(existing, incoming, now = Date.now()) {
  const retained = normalizePersonalObservations(existing, now);
  const known = new Set(retained.map(function (entry) { return entry.id; }));
  const additions = normalizePersonalObservations(incoming, now).filter(function (entry) {
    return !known.has(entry.id);
  });
  return normalizePersonalObservations(retained.concat(additions), now);
}

export function buildPersonalObservations(input = {}) {
  const marketDate = validMarketDate(input.marketDate);
  const capturedAt = validTimestamp(input.capturedAt);
  const quotes = input.quotes && typeof input.quotes === "object" ? input.quotes : {};
  const peaks = input.peaks && typeof input.peaks === "object" ? input.peaks : {};
  const benchmarkChange = finite(quotes.QQQ?.changePercent);
  const rules = normalizeRules(input.strategyRules);
  if (!marketDate || !capturedAt) return [];

  const observations = [];
  (Array.isArray(input.items) ? input.items : []).forEach(function (item) {
    const symbol = String(item?.symbol || "").trim().toUpperCase();
    const quote = quotes[symbol] || {};
    const price = finite(quote.price);
    if (!symbol || price === null || price <= 0) return;
    const displayName = String(quote.name || item?.displayName || symbol).trim() || symbol;
    const peakPrice = finite(peaks[symbol]?.peakPrice);
    const drawdown = peakPrice !== null && peakPrice > 0 ? round(Math.max(0, ((peakPrice - price) / peakPrice) * 100)) : null;
    const matchedRule = rules.reduce(function (matched, rule) {
      return drawdown !== null && drawdown >= rule.drawdown ? rule : matched;
    }, null);
    if (matchedRule) {
      observations.push(createObservation({
        marketDate, capturedAt, symbol, displayName, kind: "drawdown_rule", priority: 100, discriminator: "drawdown-" + matchedRule.drawdown,
        title: "触发回撤纪律",
        detail: "较本地跟踪峰值回撤 " + drawdown.toFixed(2) + "% ，达到个人规则阈值 " + matchedRule.drawdown + "%（规则动作：卖出 " + matchedRule.sellPercent + "%）。系统只记录触发，是否执行仍由你确认。",
        metrics: { currentPrice: round(price), peakPrice: round(peakPrice), drawdownPercent: drawdown, ruleDrawdown: matchedRule.drawdown, ruleSellPercent: matchedRule.sellPercent }
      }));
    }

    const target = finite(item?.targetPrice);
    if (target !== null && target > 0) {
      const previousClose = finite(quote.previousClose);
      const direction = target >= (previousClose !== null && previousClose > 0 ? previousClose : price) ? "up" : "down";
      const hit = direction === "up" ? price >= target : price <= target;
      const distancePercent = round(((target - price) / price) * 100, 2);
      if (hit) {
        observations.push(createObservation({
          marketDate, capturedAt, symbol, displayName, kind: "target_hit", priority: 90, discriminator: direction + "-" + target,
          title: direction === "up" ? "达到上行目标价" : "达到下行目标价",
          detail: "当前价格 " + price.toFixed(2) + " 已" + (direction === "up" ? "达到或超过" : "达到或低于") + "个人目标价 " + target.toFixed(2) + "。这是观察记录，不代表自动买卖。",
          metrics: { currentPrice: round(price), targetPrice: round(target), targetDirection: direction, distancePercent }
        }));
      } else if (Math.abs(distancePercent) <= 3) {
        observations.push(createObservation({
          marketDate, capturedAt, symbol, displayName, kind: "target_near", priority: 70, discriminator: direction + "-" + target,
          title: "接近个人目标价",
          detail: "当前价格距离个人目标价约 " + Math.abs(distancePercent).toFixed(2) + "% ，可提前复核到价后的个人计划。",
          metrics: { currentPrice: round(price), targetPrice: round(target), targetDirection: direction, distancePercent }
        }));
      }
    }

    const changePercent = finite(quote.changePercent);
    const relativeQqq = benchmarkChange !== null && changePercent !== null ? round(changePercent - benchmarkChange, 2) : null;
    if (relativeQqq !== null && relativeQqq <= -2) {
      observations.push(createObservation({
        marketDate, capturedAt, symbol, displayName, kind: "relative_weakness", priority: 60, discriminator: "qqq-minus-2",
        title: "明显跑输 QQQ",
        detail: "当日相对 QQQ 低 " + Math.abs(relativeQqq).toFixed(2) + "% 。需要结合公司公告和市场环境判断，系统不推断原因。",
        metrics: { changePercent: round(changePercent, 2), benchmarkChangePercent: round(benchmarkChange, 2), relativeQqqPercent: relativeQqq }
      }));
    }
    if (changePercent !== null && changePercent <= -3) {
      observations.push(createObservation({
        marketDate, capturedAt, symbol, displayName, kind: "daily_drop", priority: 50, discriminator: "daily-minus-3",
        title: "单日跌幅超过 3%",
        detail: "当日变动 " + changePercent.toFixed(2) + "% 。这是价格事实记录，需在公开来源中复核是否存在相关事件。",
        metrics: { changePercent: round(changePercent, 2), currentPrice: round(price) }
      }));
    }
  });
  return normalizePersonalObservations(observations, new Date(capturedAt).getTime());
}
