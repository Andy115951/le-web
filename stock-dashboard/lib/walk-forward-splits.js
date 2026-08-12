const WALK_FORWARD_SPLIT_VERSION = "qqq-walk-forward-v1";
const DEFAULT_HORIZON_TRADING_DAYS = 20;
const DEFAULT_MIN_TRAINING_DAYS = 252;
const DEFAULT_EVALUATION_DAYS = 63;
const DEFAULT_STEP_DAYS = 63;

function positiveInteger(value, fallback) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function marketDateOf(row) {
  return String(row?.market_date || row?.marketDate || "");
}

function hasMatureTwentyDayLabel(row) {
  const value = row?.return_20d_percent ?? row?.return20dPercent;
  return Number.isFinite(Number(value));
}

function normalizeFeatureDates(features, labels) {
  const labelByDate = new Map((Array.isArray(labels) ? labels : []).map(function (label) {
    return [marketDateOf(label), label];
  }));
  const seen = new Set();
  return (Array.isArray(features) ? features : []).map(function (feature) {
    const date = marketDateOf(feature);
    return { date, feature, label: labelByDate.get(date) || null };
  }).filter(function (row) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || seen.has(row.date)) return false;
    seen.add(row.date);
    return true;
  }).sort(function (left, right) { return left.date.localeCompare(right.date); });
}

function buildWalkForwardSplits(options = {}) {
  const horizonTradingDays = positiveInteger(options.horizonTradingDays, DEFAULT_HORIZON_TRADING_DAYS);
  const minTrainingDays = positiveInteger(options.minTrainingDays, DEFAULT_MIN_TRAINING_DAYS);
  const evaluationDays = positiveInteger(options.evaluationDays, DEFAULT_EVALUATION_DAYS);
  const stepDays = positiveInteger(options.stepDays, DEFAULT_STEP_DAYS);
  const rows = normalizeFeatureDates(options.features, options.labels);
  const lastMatureIndex = rows.reduce(function (result, row, index) {
    return hasMatureTwentyDayLabel(row.label) ? index : result;
  }, -1);
  const firstEvaluationIndex = minTrainingDays + horizonTradingDays;
  const splits = [];
  for (let evaluationStart = firstEvaluationIndex; evaluationStart <= lastMatureIndex; evaluationStart += stepDays) {
    const evaluationEnd = Math.min(evaluationStart + evaluationDays - 1, lastMatureIndex);
    const trainingEnd = evaluationStart - horizonTradingDays - 1;
    if (trainingEnd < minTrainingDays - 1) continue;
    const training = rows.slice(0, trainingEnd + 1);
    const evaluation = rows.slice(evaluationStart, evaluationEnd + 1);
    if (!evaluation.length || training.some(function (row) { return !hasMatureTwentyDayLabel(row.label); })) continue;
    splits.push({
      id: "fold-" + String(splits.length + 1).padStart(2, "0"),
      training: {
        startDate: training[0].date,
        endDate: training.at(-1).date,
        observationCount: training.length
      },
      embargo: {
        startDate: rows[trainingEnd + 1]?.date || null,
        endDate: rows[evaluationStart - 1]?.date || null,
        tradingDays: horizonTradingDays
      },
      evaluation: {
        startDate: evaluation[0].date,
        endDate: evaluation.at(-1).date,
        observationCount: evaluation.length
      }
    });
  }
  return {
    splitVersion: WALK_FORWARD_SPLIT_VERSION,
    instrument: String(options.instrument?.symbol || options.symbol || "QQQ").toUpperCase(),
    featureVersion: rows[0]?.feature?.feature_version || rows[0]?.feature?.featureVersion || null,
    labelVersion: rows.find(function (row) { return row.label; })?.label?.label_version || rows.find(function (row) { return row.label; })?.label?.labelVersion || null,
    horizonTradingDays,
    minTrainingDays,
    evaluationDays,
    stepDays,
    dataStartDate: rows[0]?.date || null,
    dataEndDate: rows.at(-1)?.date || null,
    lastMatureOutcomeDate: lastMatureIndex >= 0 ? rows[lastMatureIndex].date : null,
    eligibleObservationCount: lastMatureIndex + 1,
    splits
  };
}

function validateWalkForwardManifest(manifest) {
  const value = manifest && typeof manifest === "object" ? manifest : {};
  const errors = [];
  if (value.splitVersion !== WALK_FORWARD_SPLIT_VERSION) errors.push("Unsupported split version");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value.dataStartDate || ""))) errors.push("Missing data start date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value.lastMatureOutcomeDate || ""))) errors.push("Missing mature outcome cutoff");
  if (!Array.isArray(value.splits) || !value.splits.length) errors.push("No walk-forward splits available");
  (Array.isArray(value.splits) ? value.splits : []).forEach(function (split, index) {
    const trainingEnd = String(split?.training?.endDate || "");
    const evaluationStart = String(split?.evaluation?.startDate || "");
    const embargoDays = Number(split?.embargo?.tradingDays);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trainingEnd) || !/^\d{4}-\d{2}-\d{2}$/.test(evaluationStart)) {
      errors.push("Split " + index + " has invalid dates");
    }
    if (!Number.isInteger(embargoDays) || embargoDays < 1) errors.push("Split " + index + " has no outcome embargo");
    if (trainingEnd >= evaluationStart) errors.push("Split " + index + " overlaps training and evaluation");
  });
  return { valid: errors.length === 0, errors };
}

module.exports = {
  DEFAULT_EVALUATION_DAYS,
  DEFAULT_HORIZON_TRADING_DAYS,
  DEFAULT_MIN_TRAINING_DAYS,
  DEFAULT_STEP_DAYS,
  WALK_FORWARD_SPLIT_VERSION,
  buildWalkForwardSplits,
  hasMatureTwentyDayLabel,
  normalizeFeatureDates,
  validateWalkForwardManifest
};
