const EVALUATION_REGIME_DIAGNOSTIC_VERSION = "qqq-evaluation-regime-diagnostic-v1";
const REGIME_RULE_VERSION = "posthoc-qqq-63d-regime-rules-v1";
const REGIME_RULES = {
  stressDrawdownPercent: -10,
  annualizedVolatilityPercent: 28,
  strongTrendReturnPercent: 8,
  rangeBoundReturnPercent: 4,
  rangeBoundDrawdownPercent: -8
};

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 6) {
  const parsed = finite(value);
  return parsed === null ? null : Number(parsed.toFixed(digits));
}

function normalizedPrices(rows) {
  return (Array.isArray(rows) ? rows : []).map(function (row) {
    return {
      marketDate: String(row?.market_date || row?.marketDate || ""),
      adjustedClose: finite(row?.adjusted_close ?? row?.adjustedClose),
      source: row?.source || null
    };
  }).filter(function (row) {
    return /^\d{4}-\d{2}-\d{2}$/.test(row.marketDate) && row.adjustedClose !== null && row.adjustedClose > 0;
  }).sort(function (left, right) { return left.marketDate.localeCompare(right.marketDate); });
}

function maximumDrawdownPercent(values) {
  let peak = null;
  let maximumDrawdown = 0;
  values.forEach(function (value) {
    if (peak === null || value > peak) peak = value;
    if (peak && value < peak) maximumDrawdown = Math.min(maximumDrawdown, (value / peak - 1) * 100);
  });
  return maximumDrawdown;
}

function annualizedVolatilityPercent(values) {
  if (values.length < 2) return null;
  const returns = values.slice(1).map(function (value, index) { return value / values[index] - 1; });
  if (returns.length < 2) return null;
  const mean = returns.reduce(function (sum, value) { return sum + value; }, 0) / returns.length;
  const variance = returns.reduce(function (sum, value) { return sum + Math.pow(value - mean, 2); }, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function classifyRegime(metrics, rules = REGIME_RULES) {
  const observedReturnPercent = finite(metrics?.observedReturnPercent);
  const maximumDrawdown = finite(metrics?.maximumDrawdownPercent);
  const volatility = finite(metrics?.annualizedVolatilityPercent);
  if (observedReturnPercent === null || maximumDrawdown === null || volatility === null) return "unavailable";
  if (maximumDrawdown <= rules.stressDrawdownPercent) return "stress_drawdown";
  if (volatility >= rules.annualizedVolatilityPercent) return "volatile";
  if (observedReturnPercent >= rules.strongTrendReturnPercent) return "strong_uptrend";
  if (observedReturnPercent <= -rules.strongTrendReturnPercent) return "strong_downtrend";
  if (Math.abs(observedReturnPercent) <= rules.rangeBoundReturnPercent && maximumDrawdown >= rules.rangeBoundDrawdownPercent) return "range_bound";
  return "mixed";
}

function buildFoldRegimeDiagnostic(fold, rows, rules = REGIME_RULES) {
  const evaluation = fold?.evaluation || {};
  const startDate = String(evaluation.startDate || "");
  const endDate = String(evaluation.endDate || "");
  const expectedDays = Math.max(0, Math.round(Number(evaluation.observationCount) || 0));
  const prices = normalizedPrices(rows);
  const startIndex = prices.findIndex(function (row) { return row.marketDate === startDate; });
  const endIndex = prices.findIndex(function (row) { return row.marketDate === endDate; });
  if (startIndex < 1 || endIndex < startIndex) {
    return { foldId: fold?.id || null, evaluation: { startDate, endDate, observationCount: expectedDays }, status: "unavailable", reason: "Required evaluation interval prices are not present in the frozen source read." };
  }
  const interval = prices.slice(startIndex, endIndex + 1);
  if (expectedDays && interval.length !== expectedDays) {
    return { foldId: fold?.id || null, evaluation: { startDate, endDate, observationCount: expectedDays }, status: "unavailable", reason: "Stored price rows do not match the frozen evaluation observation count." };
  }
  const values = [prices[startIndex - 1].adjustedClose].concat(interval.map(function (row) { return row.adjustedClose; }));
  const metrics = {
    observedReturnPercent: round((values.at(-1) / values[0] - 1) * 100),
    maximumDrawdownPercent: round(maximumDrawdownPercent(values)),
    annualizedVolatilityPercent: round(annualizedVolatilityPercent(values)),
    observedTradingDays: interval.length
  };
  return {
    foldId: fold?.id || null,
    evaluation: { startDate, endDate, observationCount: expectedDays },
    status: "available",
    regime: { ruleVersion: REGIME_RULE_VERSION, label: classifyRegime(metrics, rules), metrics }
  };
}

function buildEvaluationRegimeDiagnostics(manifest, rows, generatedAt = new Date().toISOString()) {
  const prices = normalizedPrices(rows);
  const folds = (Array.isArray(manifest?.splits) ? manifest.splits : []).map(function (fold) { return buildFoldRegimeDiagnostic(fold, prices); });
  return {
    diagnosticVersion: EVALUATION_REGIME_DIAGNOSTIC_VERSION,
    kind: "posthoc_evaluation_interval_diagnostic",
    generatedAt: new Date(generatedAt).toISOString(),
    instrument: manifest?.instrument || "QQQ",
    splitVersion: manifest?.splitVersion || null,
    priceCoverage: {
      firstDate: prices[0]?.marketDate || null,
      lastDate: prices.at(-1)?.marketDate || null,
      rowCount: prices.length,
      sources: Array.from(new Set(prices.map(function (row) { return row.source; }).filter(Boolean))).sort()
    },
    rules: { version: REGIME_RULE_VERSION, ...REGIME_RULES },
    folds,
    limitations: [
      "Regimes are post-hoc descriptions of already completed frozen evaluation intervals, not inputs to model fitting, calibration, promotion, or runtime.",
      "The labels summarize return, realized volatility, and maximum drawdown from the recorded QQQ price path; they do not identify causes or predict a future regime.",
      "The artifact omits daily price rows, individual predictions, current probabilities, and trading instructions."
    ]
  };
}

module.exports = {
  EVALUATION_REGIME_DIAGNOSTIC_VERSION,
  REGIME_RULES,
  REGIME_RULE_VERSION,
  annualizedVolatilityPercent,
  buildEvaluationRegimeDiagnostics,
  buildFoldRegimeDiagnostic,
  classifyRegime,
  maximumDrawdownPercent,
  normalizedPrices
};
