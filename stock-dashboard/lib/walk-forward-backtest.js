const { mergeFeatureLabels, fitMomentumBaseline } = require("./walk-forward-baselines");
const { fitLogisticRegression, predictLogistic } = require("./walk-forward-logistic");
const { fitProbabilityTree, predictProbabilityTree } = require("./walk-forward-tree");

const BACKTEST_VERSION = "qqq-probability-gated-backtest-v1";
const HORIZON_DAYS = 20;
const PROBABILITY_THRESHOLD = 0.5;

function round(value, digits = 6) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

function rowsForRange(rows, range) {
  return rows.filter(function (row) { return row.date >= range.startDate && row.date <= range.endDate; });
}

function momentumBucket(feature) {
  const value = Number(feature?.return_20d_percent ?? feature?.return20dPercent);
  return Number.isFinite(value) ? value >= 0 ? "nonnegative" : "negative" : "unknown";
}

function modelPredictor(key, trainingRows) {
  if (key === "conditionalMomentum20d") {
    const fit = fitMomentumBaseline(trainingRows);
    return function (feature) { return fit.bucketProbabilities[momentumBucket(feature)] ?? fit.fallbackProbability; };
  }
  if (key === "logisticRegression") {
    const model = fitLogisticRegression(trainingRows);
    return function (feature) { return predictLogistic(model, feature); };
  }
  if (key === "shallowProbabilityTree") {
    const model = fitProbabilityTree(trainingRows);
    return function (feature) { return predictProbabilityTree(model, feature); };
  }
  throw new Error("Unsupported backtest model: " + key);
}

function maximumDrawdown(periodReturns) {
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;
  periodReturns.forEach(function (periodReturn) {
    equity *= 1 + periodReturn / 100;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity / peak - 1);
  });
  return maxDrawdown * 100;
}

function summary(decisions) {
  const returns = decisions.map(function (item) { return item.realizedReturnPercent; });
  const invested = decisions.filter(function (item) { return item.invested; }).length;
  const sorted = returns.slice().sort(function (left, right) { return left - right; });
  const cumulative = returns.reduce(function (equity, periodReturn) { return equity * (1 + periodReturn / 100); }, 1);
  return {
    decisionCount: decisions.length,
    investedDecisionCount: invested,
    investedRate: decisions.length ? round(invested / decisions.length) : null,
    averageReturnPercent: returns.length ? round(returns.reduce(function (sum, value) { return sum + value; }, 0) / returns.length) : null,
    medianReturnPercent: returns.length ? round(sorted[Math.floor((sorted.length - 1) / 2)]) : null,
    positiveReturnRate: returns.length ? round(returns.filter(function (value) { return value > 0; }).length / returns.length) : null,
    cumulativeReturnPercent: round((cumulative - 1) * 100),
    maximumDrawdownPercent: round(maximumDrawdown(returns))
  };
}

function simulateModel(rows, splits, key) {
  const decisions = [];
  splits.forEach(function (split) {
    const training = rowsForRange(rows, split.training);
    const evaluation = rowsForRange(rows, split.evaluation);
    const predict = modelPredictor(key, training);
    evaluation.forEach(function (row, index) {
      if (index % HORIZON_DAYS !== 0) return;
      const probability = predict(row.feature);
      const return20d = Number(row.label?.return_20d_percent ?? row.label?.return20dPercent);
      if (!Number.isFinite(probability) || !Number.isFinite(return20d)) return;
      const invested = probability >= PROBABILITY_THRESHOLD;
      decisions.push({ invested, realizedReturnPercent: invested ? return20d : 0 });
    });
  });
  return summary(decisions);
}

function simulateAlwaysLong(rows, splits) {
  const decisions = [];
  splits.forEach(function (split) {
    rowsForRange(rows, split.evaluation).forEach(function (row, index) {
      if (index % HORIZON_DAYS !== 0) return;
      const return20d = Number(row.label?.return_20d_percent ?? row.label?.return20dPercent);
      if (Number.isFinite(return20d)) decisions.push({ invested: true, realizedReturnPercent: return20d });
    });
  });
  return summary(decisions);
}

function buildWalkForwardBacktest(options = {}) {
  const manifest = options.manifest && typeof options.manifest === "object" ? options.manifest : {};
  const rows = mergeFeatureLabels(options.features, options.labels);
  const splits = Array.isArray(manifest.splits) ? manifest.splits : [];
  return {
    backtestVersion: BACKTEST_VERSION,
    deploymentStatus: "research_only_not_selected",
    splitVersion: manifest.splitVersion || null,
    instrument: manifest.instrument || null,
    methodology: {
      horizonTradingDays: HORIZON_DAYS,
      probabilityThreshold: PROBABILITY_THRESHOLD,
      schedule: "Within each frozen evaluation fold, sample every 20th trading day. Each simulated period uses its mature 20-trading-day label and does not overlap another sampled period within that fold.",
      limitation: "Research-only aggregate simulation. It excludes transaction costs, taxes, slippage, live execution, individual prediction records, and investment instructions."
    },
    benchmark: { key: "alwaysLongQQQ", summary: simulateAlwaysLong(rows, splits) },
    candidates: [
      { key: "conditionalMomentum20d", summary: simulateModel(rows, splits, "conditionalMomentum20d") },
      { key: "logisticRegression", summary: simulateModel(rows, splits, "logisticRegression") },
      { key: "shallowProbabilityTree", summary: simulateModel(rows, splits, "shallowProbabilityTree") }
    ]
  };
}

module.exports = { BACKTEST_VERSION, buildWalkForwardBacktest, maximumDrawdown, simulateModel };
