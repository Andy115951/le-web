export const BEGINNER_READING_VERSION = "beginner-reading-v1";
export const BEGINNER_READING_SECTION_IDS = ["market", "leaders", "news_calendar", "history", "personal"];

const SECTION_TITLES = {
  market: "大盘",
  leaders: "权重股相对 QQQ",
  news_calendar: "资讯和日历",
  history: "历史对照",
  personal: "和你有关"
};

const DRIVER_LABELS = {
  market: "更像跟着大盘",
  company: "相对大盘走得更明显，且有个股公开资讯",
  mixed: "大盘和个股线索同时存在",
  unclear: "系统连不上单一原因",
  insufficient_evidence: "系统连不上单一原因"
};

const OBSERVATION_KIND_LABELS = {
  drawdown_rule: "回撤纪律",
  target_hit: "目标已到",
  target_near: "临近目标",
  relative_weakness: "相对 QQQ 偏弱",
  daily_drop: "当日波动较大"
};

const VOLATILITY_LABELS = {
  elevated: "偏高",
  high: "偏高",
  normal: "中等",
  medium: "中等",
  calm: "偏低",
  low: "偏低"
};

const EMPTY = {
  noBenchmark: "没有纳指基准，无法做关联解读。",
  noBenchmarkLeaders: "没有纳指基准，无法对照权重股相对 QQQ 的偏离。",
  noLeaders: "当前没有可对照 QQQ 的核心成分报价。",
  noLinkedCause: "系统没有连上单一原因，下面的卡片仍可单独看。",
  noNews: "今天没有可复核的公开资讯与涨跌连在一起。",
  noEarnings: "当前范围内没有已归档的官方财报事项。",
  noHistory: "还没有足够的已成熟历史样本，不展示经验分布。",
  noPersonal: "今天没有触发你设置的纪律。",
  intraday: "这是盘中对照，收盘后才会有完整日历和研究包；不把盘中价说成收盘事实。"
};

export const BANNED_BEGINNER_READING_PATTERNS = [
  /\b(buy|sell|long|short|overweight|underweight)\b/i,
  /买入|卖出|加仓|减仓|建仓|清仓|止盈|止损|目标价|价格目标|投资建议|荐股|必涨|必跌/,
  /预测概率|上涨概率|下跌概率|胜率预测|probability forecast/i,
  /该买|该卖/,
  /所以跌了|利空落地|被消息打压/,
  /导致(?!.*不能)/
];

export function containsBannedBeginnerReading(value) {
  const text = String(value || "");
  if (!text) return false;
  return BANNED_BEGINNER_READING_PATTERNS.some(function (pattern) {
    return pattern.test(text);
  });
}

export function assertSafeBeginnerReadingText(value) {
  const text = String(value || "");
  if (containsBannedBeginnerReading(text)) {
    throw new Error("Beginner reading contains prohibited language");
  }
  return text;
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validMarketDate(value) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (new Date(date + "T12:00:00.000Z").toISOString().slice(0, 10) !== date) return null;
  return date;
}

function formatSignedPercent(value) {
  const number = finiteNumber(value);
  if (number === null) return null;
  const rounded = Number(number.toFixed(2));
  return (rounded > 0 ? "+" : "") + rounded.toFixed(2) + "%";
}

function sameDirection(left, right) {
  return (left > 0 && right > 0) || (left < 0 && right < 0) || (left === 0 && right === 0);
}

function driverLabel(value) {
  const key = String(value || "").trim();
  return DRIVER_LABELS[key] || DRIVER_LABELS.unclear;
}

function section(id, paragraphs) {
  return {
    id,
    title: SECTION_TITLES[id],
    paragraphs: (Array.isArray(paragraphs) ? paragraphs : []).map(function (item) {
      return String(item || "").trim();
    }).filter(Boolean)
  };
}

function buildMarketSection(input, mode) {
  const qqq = finiteNumber(input.qqqChangePercent);
  if (qqq === null) return section("market", [EMPTY.noBenchmark]);
  const parts = [];
  if (mode === "intraday") parts.push(EMPTY.intraday);
  parts.push("QQQ 当日 " + formatSignedPercent(qqq) + "。");
  const volatility = VOLATILITY_LABELS[String(input.volatilityLevel || "").trim()];
  if (volatility) parts.push("后视波动标记为" + volatility + "。");
  const mags = finiteNumber(input.magsChangePercent);
  if (mags !== null) {
    const relative = Number((mags - qqq).toFixed(2));
    const relation = sameDirection(mags, qqq) ? "同向" : "反向";
    parts.push("MAGS 与 QQQ " + relation + "（MAGS " + formatSignedPercent(mags) + "，相对 QQQ " + formatSignedPercent(relative) + "）。");
  }
  return section("market", parts);
}

function buildLeadersSection(input) {
  const qqq = finiteNumber(input.qqqChangePercent);
  if (qqq === null) return section("leaders", [EMPTY.noBenchmarkLeaders]);
  const ranked = (Array.isArray(input.components) ? input.components : []).map(function (item) {
    const relative = finiteNumber(item?.relativeToQqq);
    const change = finiteNumber(item?.changePercent);
    const symbol = String(item?.symbol || "").trim().toUpperCase();
    if (!symbol || relative === null || change === null) return null;
    return {
      symbol,
      relative,
      change,
      classification: item.classification || item.driverType || "unclear"
    };
  }).filter(Boolean).sort(function (left, right) {
    return Math.abs(right.relative) - Math.abs(left.relative);
  }).slice(0, 3);
  if (!ranked.length) return section("leaders", [EMPTY.noLeaders]);
  const paragraphs = ranked.map(function (item) {
    const direction = item.relative >= 0 ? "高出" : "低出";
    return item.symbol + " 相对 QQQ " + direction + " " + formatSignedPercent(Math.abs(item.relative)) + "。系统标记为：" + driverLabel(item.classification) + "。";
  });
  const linked = ranked.some(function (item) {
    return item.classification === "market" || item.classification === "company" || item.classification === "mixed";
  });
  if (!linked) paragraphs.push(EMPTY.noLinkedCause);
  return section("leaders", paragraphs);
}

function isUpcomingEarnings(entry, marketDate) {
  const status = String(entry?.status || "scheduled").trim();
  const eventDate = validMarketDate(entry?.marketDate);
  if (status === "scheduled") return true;
  if (eventDate && marketDate && eventDate > marketDate) return true;
  return false;
}

function buildNewsCalendarSection(input, marketDate) {
  const paragraphs = [];
  const news = (Array.isArray(input.news) ? input.news : []).filter(function (item) {
    return String(item?.title || "").trim() && String(item?.url || "").trim();
  }).slice(0, 2);
  if (!news.length) {
    paragraphs.push(EMPTY.noNews);
  } else {
    news.forEach(function (item) {
      const classification = item.classification || item.driverType || "unclear";
      paragraphs.push("公开资讯《" + String(item.title).trim().slice(0, 120) + "》可复核来源已保留。系统将其与涨跌标记为：" + driverLabel(classification) + "。");
    });
  }
  const earnings = (Array.isArray(input.earnings) ? input.earnings : []).filter(function (item) {
    return String(item?.symbol || "").trim();
  }).slice(0, 4);
  if (!earnings.length) {
    paragraphs.push(EMPTY.noEarnings);
  } else {
    earnings.forEach(function (item) {
      const symbol = String(item.symbol).trim().toUpperCase();
      const eventDate = validMarketDate(item.marketDate) || "日期未标";
      const period = String(item.fiscalPeriod || "").trim();
      const label = period ? symbol + " " + period : symbol;
      if (isUpcomingEarnings(item, marketDate)) {
        paragraphs.push(label + " 预定于 " + eventDate + "，这是日历上的预定事项，不能拿来解释今天的涨跌。");
      } else {
        paragraphs.push(label + " 在财报日历中记录于 " + eventDate + "，这是官方事项记录，不是当天涨跌原因。");
      }
    });
  }
  return section("news_calendar", paragraphs);
}

function outcomeLine(label, summary) {
  const median = formatSignedPercent(summary?.medianPercent);
  if (!median) return null;
  const p25 = formatSignedPercent(summary?.p25Percent);
  const p75 = formatSignedPercent(summary?.p75Percent);
  const quartile = p25 && p75 ? "（四分位 " + p25 + " 至 " + p75 + "）" : "";
  return label + " " + median + quartile + "。";
}

function buildHistorySection(input) {
  const scenario = input.scenario && typeof input.scenario === "object" ? input.scenario : {};
  const status = String(scenario.status || "awaiting_target");
  if (status !== "ready") return section("history", [EMPTY.noHistory]);
  const sample = scenario.sample || {};
  const count = Math.max(0, Math.floor(Number(sample.candidateCount) || 0));
  if (!count) return section("history", [EMPTY.noHistory]);
  const outcomes = scenario.outcomes || {};
  const paragraphs = [
    "历史上这组样本有 " + count + " 个已成熟交易日（上限 5）。"
  ];
  const line5 = outcomeLine("历史后 5 日中位收益", outcomes.return5d);
  const line20 = outcomeLine("历史后 20 日中位收益", outcomes.return20d);
  const drawdown = outcomeLine("历史 20 日回撤中位", outcomes.maxDrawdown20d);
  if (line5) paragraphs.push(line5);
  if (line20) paragraphs.push(line20);
  if (drawdown) paragraphs.push(drawdown);
  const rate5 = finiteNumber(outcomes.return5d?.positiveRatePercent);
  const rate20 = finiteNumber(outcomes.return20d?.positiveRatePercent);
  if (rate5 !== null || rate20 !== null) {
    const parts = [];
    if (rate5 !== null) parts.push("5 日 " + Number(rate5.toFixed(0)) + "%");
    if (rate20 !== null) parts.push("20 日 " + Number(rate20.toFixed(0)) + "%");
    paragraphs.push("这组历史样本里收涨的比例：" + parts.join("，") + "。这是回顾不是预测。");
  } else {
    paragraphs.push("这是回顾不是预测。");
  }
  if (sample.isSmallSample === true || count < 5) {
    paragraphs.push("小样本，仅作线索。");
  }
  return section("history", paragraphs);
}

function buildPersonalSection(input, qqqChange) {
  const observations = (Array.isArray(input.observations) ? input.observations : []).filter(function (item) {
    return String(item?.symbol || "").trim() && OBSERVATION_KIND_LABELS[item.kind];
  }).sort(function (left, right) {
    return (Number(right.priority) || 0) - (Number(left.priority) || 0);
  }).slice(0, 2);
  if (!observations.length) return section("personal", [EMPTY.noPersonal]);
  const paragraphs = observations.map(function (item) {
    const symbol = String(item.symbol).trim().toUpperCase();
    const kind = OBSERVATION_KIND_LABELS[item.kind];
    const change = finiteNumber(item.changePercent);
    let relation = "无法对照当天 QQQ";
    if (item.alignedWithQqq === true) relation = "与当天 QQQ 同向";
    else if (item.alignedWithQqq === false) relation = "与当天 QQQ 反向";
    else if (change !== null && qqqChange !== null) {
      relation = sameDirection(change, qqqChange) ? "与当天 QQQ 同向" : "与当天 QQQ 反向";
    }
    return symbol + " 触发了" + kind + "。当天该股" + relation + "。";
  });
  return section("personal", paragraphs);
}

export function buildBeginnerReading(input, options = {}) {
  const source = input && typeof input === "object" ? input : {};
  const marketDate = validMarketDate(source.marketDate);
  if (!marketDate) throw new Error("Invalid beginner reading market date");
  const mode = source.mode === "close" ? "close" : "intraday";
  const generatedAt = options.now instanceof Date
    ? options.now.toISOString()
    : (typeof options.now === "string" && !Number.isNaN(new Date(options.now).getTime())
      ? new Date(options.now).toISOString()
      : new Date().toISOString());
  const qqqChange = finiteNumber(source.qqqChangePercent);
  const sections = [
    buildMarketSection(source, mode),
    buildLeadersSection(source),
    buildNewsCalendarSection(source, marketDate),
    buildHistorySection(source),
    buildPersonalSection(source, qqqChange)
  ];
  if (sections.map(function (item) { return item.id; }).join() !== BEGINNER_READING_SECTION_IDS.join()) {
    throw new Error("Beginner reading sections must stay in a fixed order");
  }
  const reading = {
    version: BEGINNER_READING_VERSION,
    marketDate,
    mode,
    generatedAt,
    sections
  };
  assertSafeBeginnerReadingText(JSON.stringify(reading));
  return reading;
}

export function getBeginnerReadingView(reading, variant) {
  const isDay = variant === "day";
  const hasBody = Boolean(reading && Array.isArray(reading.sections) && reading.sections.length === 5);
  return {
    variant: isDay ? "day" : "home",
    hasBody,
    title: isDay ? "这一天怎么读" : "今日怎么读",
    hint: "把当前屏幕上的纳指、新闻、日历和你的纪律串起来读；不是预测，也不是买卖建议。",
    primaryLabel: hasBody ? "按当前页面再读一次" : (isDay ? "读一下这一天" : "读一下今天"),
    collapseLabel: hasBody ? "收起" : null,
    polishLabel: hasBody ? "用 AI 润色这一篇" : null,
    polishState: reading && reading.polishState || null,
    polishError: reading && reading.polishError || null,
    generatedAt: hasBody ? reading.generatedAt : null,
    sections: hasBody ? reading.sections : null
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderBeginnerReadingMarkup(view) {
  const source = view && typeof view === "object" ? view : getBeginnerReadingView(null, "home");
  const actions = [
    '<button type="button" class="btn btn-primary" data-beginner-reading-action="generate">' + escapeHtml(source.primaryLabel) + "</button>"
  ];
  if (source.polishLabel) {
    const polishBusy = source.polishState === "loading";
    actions.push(
      '<button type="button" class="btn btn-ghost" data-beginner-reading-action="polish"'
      + (polishBusy ? " disabled" : "")
      + ">"
      + escapeHtml(polishBusy ? "正在润色…" : source.polishLabel)
      + "</button>"
    );
  }
  if (source.collapseLabel) {
    actions.push('<button type="button" class="btn btn-ghost" data-beginner-reading-action="collapse">' + escapeHtml(source.collapseLabel) + "</button>");
  }
  let meta = "";
  if (source.hasBody && source.generatedAt) {
    meta = '<p class="beginner-reading-generated">生成于点击时刻 · ' + escapeHtml(source.generatedAt) + "</p>";
  }
  if (source.polishState === "applied") {
    meta += '<p class="beginner-reading-generated">已用 AI 润色通顺，数字和分类仍来自模板。</p>';
  } else if (source.polishError) {
    meta += '<p class="beginner-reading-generated">' + escapeHtml(source.polishError) + "</p>";
  }
  let body = "";
  if (source.hasBody) {
    body = '<div class="beginner-reading-sections">' + source.sections.map(function (item) {
      return [
        '<section class="beginner-reading-section" data-beginner-reading-section="' + escapeHtml(item.id) + '">',
        "<h3>" + escapeHtml(item.title) + "</h3>",
        item.paragraphs.map(function (paragraph) { return "<p>" + escapeHtml(paragraph) + "</p>"; }).join(""),
        "</section>"
      ].join("");
    }).join("") + "</div>";
  }
  return [
    '<div class="overview-head">',
    "<div><p class=\"eyebrow\">GUIDED READING</p><h2>" + escapeHtml(source.title) + "</h2></div>",
    "</div>",
    '<p class="muted beginner-reading-hint">' + escapeHtml(source.hint) + "</p>",
    '<div class="beginner-reading-actions">' + actions.join("") + "</div>",
    meta,
    body
  ].join("");
}
