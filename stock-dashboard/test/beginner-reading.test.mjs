import assert from "node:assert/strict";
import test from "node:test";
import {
  BEGINNER_READING_SECTION_IDS,
  BEGINNER_READING_VERSION,
  assertSafeBeginnerReadingText,
  buildBeginnerReading,
  containsBannedBeginnerReading,
  getBeginnerReadingView,
  renderBeginnerReadingMarkup
} from "../lib/beginner-reading.mjs";

const generatedAt = "2026-08-23T16:05:00.000Z";

function baseInput(overrides = {}) {
  return {
    marketDate: "2026-08-21",
    mode: "close",
    qqqChangePercent: -1.2,
    magsChangePercent: -1.5,
    volatilityLevel: "elevated",
    components: [
      { symbol: "NVDA", changePercent: -3.4, relativeToQqq: -2.2, driverType: "company" },
      { symbol: "AAPL", changePercent: -0.4, relativeToQqq: 0.8, driverType: "market" },
      { symbol: "MSFT", changePercent: -1.1, relativeToQqq: 0.1, driverType: "unclear" }
    ],
    news: [{
      title: "NVIDIA comments on data center demand",
      url: "https://investor.nvidia.com/example",
      driverType: "company"
    }],
    earnings: [{
      symbol: "NVDA",
      marketDate: "2026-08-26",
      status: "scheduled",
      fiscalPeriod: "FY2027 Q2"
    }],
    scenario: {
      status: "ready",
      sample: { candidateCount: 3, maximumCandidateCount: 5, isSmallSample: true },
      outcomes: {
        return5d: { medianPercent: 1.2, p25Percent: -0.5, p75Percent: 2.4, positiveRatePercent: 66.6 },
        return20d: { medianPercent: 3.1, p25Percent: -2, p75Percent: 7, positiveRatePercent: 60 },
        maxDrawdown20d: { medianPercent: -4.2, p25Percent: -8, p75Percent: -2 }
      }
    },
    observations: [],
    ...overrides
  };
}

function allText(reading) {
  return reading.sections.map(function (section) {
    return section.title + " " + section.paragraphs.join(" ");
  }).join("\n");
}

test("buildBeginnerReading always returns five fixed sections from visible fields", function () {
  const reading = buildBeginnerReading(baseInput(), { now: generatedAt });
  assert.equal(reading.version, BEGINNER_READING_VERSION);
  assert.equal(reading.marketDate, "2026-08-21");
  assert.equal(reading.mode, "close");
  assert.equal(reading.generatedAt, generatedAt);
  assert.deepEqual(reading.sections.map(function (section) { return section.id; }), BEGINNER_READING_SECTION_IDS);
  const text = allText(reading);
  assert.match(text, /QQQ 当日 -1\.20%/);
  assert.match(text, /NVDA 相对 QQQ 低出 \+2\.20%/);
  assert.match(text, /系统标记为：相对大盘走得更明显/);
  assert.match(text, /FY2027 Q2 预定于 2026-08-26/);
  assert.match(text, /不能拿来解释今天的涨跌/);
  assert.match(text, /这组历史样本里收涨的比例/);
  assert.match(text, /小样本，仅作线索/);
  assert.match(text, /今天没有触发你设置的纪律/);
  assert.equal(text.includes("上涨概率"), false);
  assert.equal(text.includes("所以跌了"), false);
});

test("missing QQQ uses empty states and does not invent a benchmark from MAGS", function () {
  const reading = buildBeginnerReading(baseInput({ qqqChangePercent: null, magsChangePercent: -2 }), { now: generatedAt });
  const text = allText(reading);
  assert.match(reading.sections[0].paragraphs.join(""), /没有纳指基准，无法做关联解读/);
  assert.match(reading.sections[1].paragraphs.join(""), /没有纳指基准，无法对照/);
  assert.equal(text.includes("MAGS"), false);
});

test("intraday mode adds the close-archive caution and does not call the session a close", function () {
  const reading = buildBeginnerReading(baseInput({ mode: "intraday" }), { now: generatedAt });
  assert.match(reading.sections[0].paragraphs[0], /这是盘中对照/);
  assert.equal(allText(reading).includes("收盘事实"), true);
});

test("scheduled earnings before the reading date cannot explain today", function () {
  const reading = buildBeginnerReading(baseInput({
    marketDate: "2026-08-23",
    earnings: [{ symbol: "NVDA", marketDate: "2026-08-26", status: "scheduled", fiscalPeriod: "FY2027 Q2" }]
  }), { now: generatedAt });
  const calendar = reading.sections.find(function (section) { return section.id === "news_calendar"; }).paragraphs.join(" ");
  assert.match(calendar, /预定事项/);
  assert.equal(/所以|导致|超预期/.test(calendar), false);
});

test("empty news, history, earnings and observations keep their empty copy", function () {
  const reading = buildBeginnerReading(baseInput({
    news: [],
    earnings: [],
    scenario: { status: "insufficient_samples" },
    observations: [],
    components: [{ symbol: "NVDA", changePercent: -3, relativeToQqq: -1.8, driverType: "unclear" }]
  }), { now: generatedAt });
  assert.match(allText(reading), /没有可复核的公开资讯/);
  assert.match(allText(reading), /没有已归档的官方财报事项/);
  assert.match(allText(reading), /还没有足够的已成熟历史样本/);
  assert.match(allText(reading), /系统没有连上单一原因/);
  assert.equal(allText(reading).includes("近期没有公司要发财报"), false);
});

test("personal section only describes triggered discipline and QQQ alignment", function () {
  const reading = buildBeginnerReading(baseInput({
    observations: [
      { symbol: "NVDA", kind: "drawdown_rule", priority: 100, changePercent: -3.4 },
      { symbol: "AAPL", kind: "relative_weakness", priority: 60, changePercent: 0.4 }
    ]
  }), { now: generatedAt });
  const personal = reading.sections.find(function (section) { return section.id === "personal"; }).paragraphs.join(" ");
  assert.match(personal, /NVDA 触发了回撤纪律/);
  assert.match(personal, /与当天 QQQ 同向/);
  assert.equal(/买入|卖出|加仓|减仓|该买|该卖/.test(personal), false);
});

test("banned phrases are rejected by the template safety check", function () {
  ["该买", "所以跌了", "上涨概率"].forEach(function (phrase) {
    assert.equal(containsBannedBeginnerReading("今天" + phrase + "了"), true);
    assert.throws(function () { assertSafeBeginnerReadingText(phrase); }, /prohibited language/);
  });
  const reading = buildBeginnerReading(baseInput(), { now: generatedAt });
  assert.doesNotThrow(function () { assertSafeBeginnerReadingText(allText(reading)); });
});

test("idle view and markup have no five-section body until the user generates one", function () {
  const idle = getBeginnerReadingView(null, "home");
  assert.equal(idle.hasBody, false);
  assert.equal(idle.sections, null);
  assert.equal(idle.primaryLabel, "读一下今天");
  const idleHtml = renderBeginnerReadingMarkup(idle);
  assert.equal(idleHtml.includes("data-beginner-reading-section"), false);
  assert.equal(idleHtml.includes("读一下今天"), true);
  assert.equal(idleHtml.includes("按当前页面再读一次"), false);

  const reading = buildBeginnerReading(baseInput(), { now: generatedAt });
  const ready = getBeginnerReadingView(reading, "home");
  assert.equal(ready.hasBody, true);
  assert.equal(ready.sections.length, 5);
  const readyHtml = renderBeginnerReadingMarkup(ready);
  BEGINNER_READING_SECTION_IDS.forEach(function (id) {
    assert.equal(readyHtml.includes('data-beginner-reading-section="' + id + '"'), true);
  });
  assert.equal(readyHtml.includes("按当前页面再读一次"), true);
  assert.equal(readyHtml.includes("生成 AI 解读"), true);
  assert.equal(idleHtml.includes("生成 AI 解读"), false);
  assert.equal(readyHtml.includes("data-beginner-reading-ai"), false);
  assert.equal(readyHtml.includes("收起"), true);
  assert.equal(getBeginnerReadingView(null, "day").primaryLabel, "读一下这一天");

  const interpreted = getBeginnerReadingView({
    ...reading,
    interpretState: "applied",
    interpretation: { paragraphs: ["QQQ 这是讲解，不是新数据。", "预定财报不能拿来解释今天。"] }
  }, "home");
  const interpretedHtml = renderBeginnerReadingMarkup(interpreted);
  assert.equal(interpretedHtml.includes("data-beginner-reading-ai"), true);
  assert.equal(interpretedHtml.includes("AI 解读"), true);
  assert.equal(interpretedHtml.includes("QQQ 这是讲解，不是新数据。"), true);
  assert.equal(interpretedHtml.includes("data-beginner-reading-section=\"market\""), true);

  const confirming = getBeginnerReadingView({ ...reading, interpretState: "confirm" }, "home");
  const confirmHtml = renderBeginnerReadingMarkup(confirming);
  assert.equal(confirmHtml.includes('data-beginner-reading-ai-state="confirm"'), true);
  assert.equal(confirmHtml.includes("data-beginner-reading-action=\"interpret-confirm\""), true);
  assert.equal(confirmHtml.includes("开始生成"), true);
  assert.equal(confirmHtml.includes("不含持仓数量和成本"), true);
  assert.equal(confirmHtml.includes("window.confirm"), false);
});
