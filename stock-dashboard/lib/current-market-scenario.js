const { getStoredSimilarDays } = require("./similar-day-store");

const CURRENT_MARKET_SCENARIO_VERSION = "qqq-current-empirical-scenario-v1";
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

function buildCurrentMarketScenario(result = {}) {
  const target = result?.target || null;
  const candidateCount = Number(result?.summary?.candidateCount || 0);
  const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(String(target?.market_date || "")) ? target.market_date : null;
  const status = !targetDate
    ? "awaiting_target"
    : candidateCount > 0
      ? "ready"
      : "insufficient_samples";

  return {
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
}

async function getCurrentMarketScenario(options = {}) {
  const symbol = String(options.symbol || DEFAULT_SYMBOL).toUpperCase();
  const loadSimilarDays = options.loadSimilarDays || getStoredSimilarDays;
  const result = await loadSimilarDays(symbol, undefined, DEFAULT_LIMIT);
  return buildCurrentMarketScenario(result);
}

module.exports = {
  CURRENT_MARKET_SCENARIO_VERSION,
  DEFAULT_LIMIT,
  buildCurrentMarketScenario,
  getCurrentMarketScenario
};
