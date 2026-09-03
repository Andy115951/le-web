const { getStoredSimilarDays } = require("./similar-day-store");

const CURRENT_MARKET_SCENARIO_VERSION = "qqq-current-empirical-scenario-v1";
const CURRENT_MARKET_SCENARIO_READING_VERSION = "qqq-current-empirical-reading-v1";
const DEFAULT_SYMBOL = "QQQ";
const DEFAULT_LIMIT = 5;

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanReturnSummary(summary) {
  return {
    availableCount: Number(summary?.availableCount || 0),
    positiveCount: Number(summary?.positiveCount || 0),
    positiveRatePercent: finiteNumber(summary?.positiveRatePercent),
    medianPercent: finiteNumber(summary?.medianPercent),
    p25Percent: finiteNumber(summary?.p25Percent),
    p75Percent: finiteNumber(summary?.p75Percent)
  };
}

function cleanDrawdownSummary(summary) {
  return {
    availableCount: Number(summary?.availableCount || 0),
    medianPercent: finiteNumber(summary?.medianPercent),
    p25Percent: finiteNumber(summary?.p25Percent),
    p75Percent: finiteNumber(summary?.p75Percent),
    worstPercent: finiteNumber(summary?.worstPercent)
  };
}

function displayPercent(value) {
  const number = finiteNumber(value);
  if (number === null) return null;
  return Number(number.toFixed(2)).toString() + "%";
}

function buildCurrentMarketScenarioReading(scenario = {}) {
  const status = String(scenario.status || "awaiting_target");
  const marketDate = String(scenario?.asOf?.marketDate || "");
  const sample = scenario.sample || {};
  if (status === "awaiting_target") {
    return {
      version: CURRENT_MARKET_SCENARIO_READING_VERSION,
      status,
      headline: "尚无可用的当前 QQQ 特征，无法形成历史样本解读。",
      observations: [],
      caution: "没有用缺失数据推断情景，也没有生成预测。"
    };
  }
  if (status !== "ready") {
    return {
      version: CURRENT_MARKET_SCENARIO_READING_VERSION,
      status,
      headline: "当前成熟历史相似样本不足，暂不形成经验分布解读。",
      observations: [],
      caution: "样本不足时不补零、不推断方向，也不生成预测。"
    };
  }
  const observations = [];
  const returnObservation = function (label, value) {
    const availableCount = Number(value?.availableCount || 0);
    const positiveCount = Number(value?.positiveCount || 0);
    const positiveRate = displayPercent(value?.positiveRatePercent);
    const median = displayPercent(value?.medianPercent);
    if (!availableCount || !positiveRate || !median) return;
    observations.push(label + "可用 " + availableCount + " 个历史样本，其中 " + positiveCount + " 个为正收益，历史正收益频率为 " + positiveRate + "；中位数为 " + median + "。");
  };
  returnObservation("后 5 个交易日", scenario?.outcomes?.return5d);
  returnObservation("后 20 个交易日", scenario?.outcomes?.return20d);
  const drawdown = scenario?.outcomes?.maxDrawdown20d || {};
  const drawdownAvailableCount = Number(drawdown.availableCount || 0);
  const drawdownMedian = displayPercent(drawdown.medianPercent);
  const drawdownWorst = displayPercent(drawdown.worstPercent);
  if (drawdownAvailableCount && drawdownMedian && drawdownWorst) {
    observations.push("历史 20 日最大回撤可用 " + drawdownAvailableCount + " 个样本，中位数为 " + drawdownMedian + "，样本中最差为 " + drawdownWorst + "。");
  }
  return {
    version: CURRENT_MARKET_SCENARIO_READING_VERSION,
    status,
    headline: "截至 " + marketDate + "，当前状态匹配到 " + Number(sample.candidateCount || 0) + " 个已成熟历史样本。",
    observations,
    caution: (sample.isSmallSample ? "样本较少，结论不牢。" : "这是有限历史样本。") + " 以上只是在描述过去结果，不是当前预测、概率或交易指令。"
  };
}

function buildCurrentMarketScenario(result = {}) {
  const target = result?.target || null;
  const candidateCount = Number(result?.summary?.candidateCount || 0);
  const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(String(target?.market_date || "")) ? target.market_date : null;
  const status = !targetDate
    ? "awaiting_target"
    : candidateCount > 0
      ? "ready"
      : "insufficient_samples";

  const scenario = {
    version: CURRENT_MARKET_SCENARIO_VERSION,
    researchOnly: true,
    symbol: String(result?.instrument?.symbol || DEFAULT_SYMBOL).toUpperCase(),
    asOf: {
      marketDate: targetDate,
      timezone: "America/New_York"
    },
    status,
    methodVersion: String(result?.methodVersion || ""),
    sample: {
      candidateCount,
      maximumCandidateCount: DEFAULT_LIMIT,
      isSmallSample: candidateCount > 0 && candidateCount < DEFAULT_LIMIT
    },
    outcomes: {
      return5d: cleanReturnSummary(result?.summary?.return5d),
      return20d: cleanReturnSummary(result?.summary?.return20d),
      maxDrawdown20d: cleanDrawdownSummary(result?.summary?.maxDrawdown20d)
    },
    limitations: [
      "This is a descriptive summary of a bounded historical analogue set, not a forecast, probability, or trading instruction.",
      "Candidate outcomes are mature historical labels and are never used as same-day market inputs."
    ]
  };
  return { ...scenario, reading: buildCurrentMarketScenarioReading(scenario) };
}

async function getCurrentMarketScenario(options = {}) {
  const symbol = String(options.symbol || DEFAULT_SYMBOL).toUpperCase();
  const loadSimilarDays = options.loadSimilarDays || getStoredSimilarDays;
  const result = await loadSimilarDays(symbol, undefined, DEFAULT_LIMIT);
  return buildCurrentMarketScenario(result);
}

module.exports = {
  CURRENT_MARKET_SCENARIO_VERSION,
  CURRENT_MARKET_SCENARIO_READING_VERSION,
  DEFAULT_LIMIT,
  buildCurrentMarketScenario,
  buildCurrentMarketScenarioReading,
  getCurrentMarketScenario
};
