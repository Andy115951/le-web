const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

function isGlobalStockSymbol(symbol) {
  const normalized = normalizeSymbol(symbol);
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(normalized);
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function rawNumber(input) {
  if (input && typeof input === "object" && "raw" in input) {
    return num(input.raw);
  }
  return num(input);
}

function metric(label, value, suffix = "") {
  return {
    label,
    value: Number.isFinite(Number(value)) ? Number(value) : null,
    suffix
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function percentChange(current, reference) {
  const a = Number(current);
  const b = Number(reference);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;
  return Number((((a - b) / b) * 100).toFixed(2));
}

function drawdownFromHigh(current, high) {
  const a = Number(current);
  const b = Number(high);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;
  return Number((((b - a) / b) * 100).toFixed(2));
}

function upsideToTarget(current, target) {
  const a = Number(current);
  const b = Number(target);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0) return null;
  return Number((((b - a) / a) * 100).toFixed(2));
}

function recommendationLabel(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return "暂无";
  if (score <= 1.5) return "强烈看多";
  if (score <= 2.5) return "偏多";
  if (score <= 3.5) return "中性";
  if (score <= 4.5) return "偏空";
  return "看空";
}

function buildDecisionSignals(detail) {
  const price = detail.price?.regularMarketPrice;
  const high52 = detail.summaryDetail?.fiftyTwoWeekHigh;
  const low52 = detail.summaryDetail?.fiftyTwoWeekLow;
  const target = detail.financialData?.targetMeanPrice;
  const recommendation = detail.financialData?.recommendationMean;
  const trailingPe = detail.summaryDetail?.trailingPE;
  const forwardPe = detail.summaryDetail?.forwardPE;
  const beta = detail.defaultKeyStatistics?.beta;
  const institutionHold = detail.defaultKeyStatistics?.heldPercentInstitutions;
  const margin = detail.financialData?.profitMargins;

  const upsidePct = upsideToTarget(price, target);
  const drawdown52Pct = drawdownFromHigh(price, high52);
  const bounceFromLowPct = percentChange(price, low52);

  const signals = [];
  const reasons = [];
  let score = 50;

  if (upsidePct !== null) {
    let tone = "neutral";
    if (upsidePct >= 20) {
      score += 12;
      tone = "positive";
      reasons.push("一致预期目标价相对现价仍有较大上行空间");
    } else if (upsidePct >= 10) {
      score += 8;
      tone = "positive";
    } else if (upsidePct <= -10) {
      score -= 12;
      tone = "negative";
      reasons.push("一致预期目标价已低于当前价格，预期空间偏弱");
    } else if (upsidePct <= 0) {
      score -= 6;
      tone = "negative";
    }
    signals.push({
      label: "目标价空间",
      tone,
      text: upsidePct >= 0 ? `较目标价仍有 ${upsidePct}% 空间` : `较目标价高出 ${Math.abs(upsidePct)}%`
    });
  }

  if (drawdown52Pct !== null) {
    let tone = "neutral";
    if (drawdown52Pct >= 30) {
      score += 8;
      tone = "positive";
      reasons.push("当前价格距 52 周高点已有明显回撤，适合观察回撤后修复机会");
    } else if (drawdown52Pct >= 15) {
      score += 4;
      tone = "positive";
    } else if (drawdown52Pct <= 5) {
      score -= 4;
      tone = "negative";
      reasons.push("价格已接近 52 周高点，短线追高空间需要更谨慎");
    }
    signals.push({
      label: "52周高点回撤",
      tone,
      text: `较 52 周高点回撤 ${drawdown52Pct}%`
    });
  }

  if (bounceFromLowPct !== null) {
    signals.push({
      label: "低位修复幅度",
      tone: bounceFromLowPct >= 80 ? "negative" : bounceFromLowPct >= 30 ? "neutral" : "positive",
      text: `较 52 周低点反弹 ${bounceFromLowPct}%`
    });
  }

  if (Number.isFinite(recommendation)) {
    let tone = "neutral";
    if (recommendation <= 2) {
      score += 8;
      tone = "positive";
      reasons.push("分析师一致预期整体偏多");
    } else if (recommendation <= 2.5) {
      score += 5;
      tone = "positive";
    } else if (recommendation >= 3.5) {
      score -= 8;
      tone = "negative";
      reasons.push("分析师一致预期偏保守");
    }
    signals.push({
      label: "一致预期",
      tone,
      text: `${recommendationLabel(recommendation)}（均值 ${recommendation.toFixed(2)}）`
    });
  }

  if (Number.isFinite(trailingPe) || Number.isFinite(forwardPe)) {
    let tone = "neutral";
    if (Number.isFinite(trailingPe) && trailingPe > 70) {
      score -= 10;
      tone = "negative";
      reasons.push("当前估值偏高，需要更强增长兑现来支撑");
    } else if (Number.isFinite(trailingPe) && trailingPe > 45) {
      score -= 6;
      tone = "negative";
    }
    if (Number.isFinite(trailingPe) && Number.isFinite(forwardPe) && forwardPe < trailingPe * 0.9) {
      score += 5;
      tone = tone === "negative" ? "neutral" : "positive";
      reasons.push("Forward PE 低于 TTM PE，市场预期后续盈利增长");
    }
    signals.push({
      label: "估值结构",
      tone,
      text: `TTM ${Number.isFinite(trailingPe) ? trailingPe.toFixed(2) : "--"} / Forward ${Number.isFinite(forwardPe) ? forwardPe.toFixed(2) : "--"}`
    });
  }

  if (Number.isFinite(margin)) {
    let tone = "neutral";
    const marginPct = Number((margin * 100).toFixed(2));
    if (margin >= 0.2) {
      score += 6;
      tone = "positive";
      reasons.push("净利率较高，基本面质量相对扎实");
    } else if (margin <= 0.05) {
      score -= 6;
      tone = "negative";
      reasons.push("净利率偏薄，业绩波动时更容易受压");
    }
    signals.push({
      label: "盈利质量",
      tone,
      text: `净利率 ${marginPct}%`
    });
  }

  if (Number.isFinite(beta)) {
    let tone = "neutral";
    if (beta >= 1.8) {
      score -= 6;
      tone = "negative";
      reasons.push("Beta 偏高，波动风险更大");
    } else if (beta <= 0.9) {
      score += 3;
      tone = "positive";
    }
    signals.push({
      label: "波动风险",
      tone,
      text: `Beta ${beta.toFixed(2)}`
    });
  }

  if (Number.isFinite(institutionHold)) {
    let tone = "neutral";
    const pct = Number((institutionHold * 100).toFixed(2));
    if (institutionHold >= 0.6) {
      score += 4;
      tone = "positive";
    } else if (institutionHold < 0.2) {
      score -= 2;
      tone = "negative";
    }
    signals.push({
      label: "机构持仓",
      tone,
      text: `${pct}%`
    });
  }

  score = clamp(Math.round(score), 0, 100);

  let stance = "中性观察";
  if (score >= 70) stance = "偏强观察";
  else if (score >= 55) stance = "继续跟踪";
  else if (score < 40) stance = "谨慎观察";

  const summary = reasons.length
    ? reasons.slice(0, 3).join("；")
    : "当前结构化信号有限，建议结合财报、行业景气度和自己的持仓计划继续判断。";

  return {
    score,
    stance,
    summary,
    signals,
    caveats: [
      "这是结构化辅助判断，不是自动买卖建议。",
      "财报、指引、宏观事件和持仓成本不会自动体现在这份分数里。"
    ]
  };
}

async function fetchJson(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": UA
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function buildQuoteSummaryUrl(symbol) {
  return "https://query1.finance.yahoo.com/v10/finance/quoteSummary/"
    + encodeURIComponent(symbol)
    + "?modules=price,summaryDetail,defaultKeyStatistics,financialData,recommendationTrend";
}

function buildSearchUrl(symbol) {
  return "https://query1.finance.yahoo.com/v1/finance/search?q="
    + encodeURIComponent(symbol)
    + "&quotesCount=1&newsCount=5";
}

function summarize(detail) {
  const parts = [];
  const price = detail.price?.regularMarketPrice;
  const changePct = detail.price?.regularMarketChangePercent;
  const trailingPe = detail.summaryDetail?.trailingPE;
  const marketCapBillions = detail.price?.marketCap == null ? null : detail.price.marketCap / 1000000000;
  const targetMean = detail.financialData?.targetMeanPrice;
  const recommendation = detail.financialData?.recommendationMean;

  if (price !== null && changePct !== null) {
    const direction = changePct > 0 ? "上涨" : changePct < 0 ? "下跌" : "平盘";
    parts.push(`当前 ${direction} ${Math.abs(changePct).toFixed(2)}%，最新价 ${price.toFixed(2)}`);
  }
  if (trailingPe !== null) {
    parts.push(`PE(TTM) ${trailingPe.toFixed(2)}`);
  }
  if (marketCapBillions !== null) {
    parts.push(`总市值约 ${marketCapBillions.toFixed(2)}B`);
  }
  if (targetMean !== null) {
    parts.push(`一致预期目标价 ${targetMean.toFixed(2)}`);
  }
  if (recommendation !== null) {
    parts.push(`综合评级均值 ${recommendation.toFixed(2)}`);
  }
  return parts.join("；");
}

function parseQuoteSummary(payload) {
  const result = payload?.quoteSummary?.result?.[0];
  if (!result) {
    const message = payload?.quoteSummary?.error?.description || "未获取到美股详情";
    throw new Error(message);
  }

  const price = result.price || {};
  const summaryDetail = result.summaryDetail || {};
  const defaultKeyStatistics = result.defaultKeyStatistics || {};
  const financialData = result.financialData || {};

  return {
    price: {
      shortName: price.shortName || price.longName || null,
      longName: price.longName || price.shortName || null,
      currency: price.currency || "USD",
      exchangeName: price.exchangeName || price.fullExchangeName || null,
      regularMarketPrice: rawNumber(price.regularMarketPrice),
      regularMarketChangePercent: rawNumber(price.regularMarketChangePercent),
      regularMarketOpen: rawNumber(price.regularMarketOpen),
      regularMarketDayHigh: rawNumber(price.regularMarketDayHigh),
      regularMarketDayLow: rawNumber(price.regularMarketDayLow),
      regularMarketPreviousClose: rawNumber(price.regularMarketPreviousClose),
      marketCap: rawNumber(price.marketCap)
    },
    summaryDetail: {
      trailingPE: rawNumber(summaryDetail.trailingPE),
      forwardPE: rawNumber(summaryDetail.forwardPE),
      priceToBook: rawNumber(summaryDetail.priceToBook),
      fiftyTwoWeekHigh: rawNumber(summaryDetail.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: rawNumber(summaryDetail.fiftyTwoWeekLow),
      dividendYield: rawNumber(summaryDetail.dividendYield)
    },
    defaultKeyStatistics: {
      beta: rawNumber(defaultKeyStatistics.beta),
      heldPercentInstitutions: rawNumber(defaultKeyStatistics.heldPercentInstitutions)
    },
    financialData: {
      targetMeanPrice: rawNumber(financialData.targetMeanPrice),
      recommendationMean: rawNumber(financialData.recommendationMean),
      numberOfAnalystOpinions: rawNumber(financialData.numberOfAnalystOpinions),
      returnOnEquity: rawNumber(financialData.returnOnEquity),
      profitMargins: rawNumber(financialData.profitMargins),
      operatingMargins: rawNumber(financialData.operatingMargins)
    }
  };
}

function parseNews(payload) {
  const news = Array.isArray(payload?.news) ? payload.news : [];
  return news.slice(0, 5).map(function (item) {
    return {
      title: item.title || "未命名资讯",
      institution: item.publisher || item.provider || "Yahoo Finance",
      rating: item.type || "资讯",
      reportDate: item.providerPublishTime
        ? new Date(item.providerPublishTime * 1000).toISOString().slice(0, 10)
        : "",
      url: item.link || item.clickThroughUrl?.url || ""
    };
  });
}

async function getGlobalStockDetail(symbol) {
  const normalized = normalizeSymbol(symbol);
  if (!isGlobalStockSymbol(normalized)) {
    throw new Error("当前分析仅支持美股代码（如 NVDA / AAPL / MSFT）");
  }

  const [quoteSummaryPayload, searchPayload] = await Promise.all([
    fetchJson(buildQuoteSummaryUrl(normalized)),
    fetchJson(buildSearchUrl(normalized)).catch(function () {
      return {};
    })
  ]);

  const detail = parseQuoteSummary(quoteSummaryPayload);
  const news = parseNews(searchPayload);
  const marketCapBillions = detail.price.marketCap == null ? null : detail.price.marketCap / 1000000000;
  const upsidePct = upsideToTarget(detail.price.regularMarketPrice, detail.financialData.targetMeanPrice);
  const drawdown52Pct = drawdownFromHigh(detail.price.regularMarketPrice, detail.summaryDetail.fiftyTwoWeekHigh);
  const decision = buildDecisionSignals(detail);

  return {
    symbol: normalized,
    name: detail.price.longName || detail.price.shortName || normalized,
    market: detail.price.exchangeName ? "美股 · " + detail.price.exchangeName : "美股",
    price: detail.price,
    valuation: detail.summaryDetail,
    financialData: detail.financialData,
    metrics: [
      metric("最新价", detail.price.regularMarketPrice),
      metric("涨跌幅", detail.price.regularMarketChangePercent, "%"),
      metric("开盘价", detail.price.regularMarketOpen),
      metric("日内高点", detail.price.regularMarketDayHigh),
      metric("日内低点", detail.price.regularMarketDayLow),
      metric("昨收", detail.price.regularMarketPreviousClose),
      metric("总市值(B)", marketCapBillions),
      metric("52周高点", detail.summaryDetail.fiftyTwoWeekHigh),
      metric("52周低点", detail.summaryDetail.fiftyTwoWeekLow),
      metric("距目标价", upsidePct, "%"),
      metric("距52周高点", drawdown52Pct, "%"),
      metric("PE(TTM)", detail.summaryDetail.trailingPE),
      metric("Forward PE", detail.summaryDetail.forwardPE),
      metric("PB", detail.summaryDetail.priceToBook),
      metric("目标价", detail.financialData.targetMeanPrice),
      metric("分析师数量", detail.financialData.numberOfAnalystOpinions),
      metric("ROE", detail.financialData.returnOnEquity == null ? null : detail.financialData.returnOnEquity * 100, "%"),
      metric("净利率", detail.financialData.profitMargins == null ? null : detail.financialData.profitMargins * 100, "%"),
      metric("机构持仓", detail.defaultKeyStatistics.heldPercentInstitutions == null ? null : detail.defaultKeyStatistics.heldPercentInstitutions * 100, "%")
    ],
    decision,
    reports: news,
    itemsTitle: "近期资讯",
    itemsEmptyText: "暂无近期资讯。",
    summary: summarize(detail),
    sourceNames: ["Yahoo Finance quoteSummary", "Yahoo Finance search/news"],
    note: "海外公开接口在国内网络下可能偶发超时或被限流。"
  };
}

module.exports = {
  isGlobalStockSymbol,
  getGlobalStockDetail
};
