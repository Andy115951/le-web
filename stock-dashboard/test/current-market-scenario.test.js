const assert = require("node:assert/strict");
const test = require("node:test");
const { CURRENT_MARKET_SCENARIO_VERSION, buildCurrentMarketScenario, getCurrentMarketScenario } = require("../lib/current-market-scenario");

test("current market scenario exposes a bounded empirical summary without raw candidates", function () {
  const scenario = buildCurrentMarketScenario({
    instrument: { symbol: "QQQ" },
    target: { market_date: "2026-08-11", internal_marker: "must-not-leak" },
    methodVersion: "qqq-price-state-v1",
    matches: [{ candidate_market_date: "2025-03-27", private_note: "must-not-leak" }],
    summary: {
      candidateCount: 3,
      return5d: { availableCount: 3, positiveCount: 2, positiveRatePercent: 66.666667, medianPercent: 1.25, p25Percent: -0.5, p75Percent: 2.5 },
      return20d: { availableCount: 3, positiveCount: 2, positiveRatePercent: 66.666667, medianPercent: 3.5, p25Percent: -2, p75Percent: 7 },
      maxDrawdown20d: { availableCount: 3, medianPercent: -4, p25Percent: -8, p75Percent: -2, worstPercent: -12 }
    }
  });

  assert.equal(scenario.version, CURRENT_MARKET_SCENARIO_VERSION);
  assert.equal(scenario.status, "ready");
  assert.equal(scenario.asOf.marketDate, "2026-08-11");
  assert.equal(scenario.sample.candidateCount, 3);
  assert.equal(scenario.sample.isSmallSample, true);
  assert.equal(scenario.outcomes.return5d.medianPercent, 1.25);
  assert.equal(scenario.outcomes.maxDrawdown20d.worstPercent, -12);
  assert.equal(JSON.stringify(scenario).includes("must-not-leak"), false);
  assert.equal(JSON.stringify(scenario).includes("candidate_market_date"), false);
  assert.match(scenario.limitations.join(" "), /not a forecast/);
});

test("current market scenario remains explicit when no current target or mature samples exist", function () {
  assert.equal(buildCurrentMarketScenario({ summary: {} }).status, "awaiting_target");
  assert.equal(buildCurrentMarketScenario({ target: { market_date: "2026-08-11" }, summary: { candidateCount: 0 } }).status, "insufficient_samples");
});

test("current market scenario always reads the latest bounded QQQ analogue set", async function () {
  const calls = [];
  const scenario = await getCurrentMarketScenario({
    loadSimilarDays: async function (...args) {
      calls.push(args);
      return { instrument: { symbol: "QQQ" }, target: { market_date: "2026-08-11" }, summary: { candidateCount: 0 } };
    }
  });

  assert.deepEqual(calls, [["QQQ", undefined, 5]]);
  assert.equal(scenario.status, "insufficient_samples");
});
