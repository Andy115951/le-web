const BASELINE_EVALUATION_VERSION = "qqq-baseline-evaluation-v1";

function round(value, digits = 6) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

function marketDateOf(row) {
  return String(row?.market_date || row?.marketDate || "");
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function labelDirection(label) {
  const value = finiteNumber(label?.return_20d_percent ?? label?.return20dPercent);
  return value === null ? null : value > 0 ? 1 : 0;
}

function momentumBucket(feature) {
  const value = finiteNumber(feature?.return_20d_percent ?? feature?.return20dPercent);
  return value === null ? "unknown" : value >= 0 ? "nonnegative" : "negative";
}

function rowsForRange(rows, range) {
  return rows.filter(function (row) {
    return row.date >= range.startDate && row.date <= range.endDate;
  });
}

function mergeFeatureLabels(features, labels) {
  const labelsByDate = new Map((Array.isArray(labels) ? labels : []).map(function (label) {
    return [marketDateOf(label), label];
  }));
  return (Array.isArray(features) ? features : []).map(function (feature) {
    const date = marketDateOf(feature);
    const label = labelsByDate.get(date) || null;
    return { date, feature, label, outcome: labelDirection(label) };
  }).filter(function (row) { return /^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.outcome !== null; })
    .sort(function (left, right) { return left.date.localeCompare(right.date); });
}

function empiricalProbability(rows) {
  const outcomes = rows.map(function (row) { return row.outcome; }).filter(function (value) { return value !== null; });
  return outcomes.length ? outcomes.reduce(function (sum, value) { return sum + value; }, 0) / outcomes.length : null;
}

function fitMomentumBaseline(trainingRows) {
  const buckets = { negative: [], nonnegative: [], unknown: [] };
  trainingRows.forEach(function (row) { buckets[momentumBucket(row.feature)].push(row); });
  const fallbackProbability = empiricalProbability(trainingRows);
  return {
    fallbackProbability,
    bucketProbabilities: Object.fromEntries(Object.entries(buckets).map(function ([bucket, rows]) {
      return [bucket, empiricalProbability(rows) ?? fallbackProbability];
    })),
    bucketSampleCounts: Object.fromEntries(Object.entries(buckets).map(function ([bucket, rows]) { return [bucket, rows.length]; }))
  };
}

function metricSummary(predictions) {
  const rows = Array.isArray(predictions) ? predictions : [];
  if (!rows.length) return { sampleCount: 0, accuracy: null, balancedAccuracy: null, brierScore: null, actualUpRate: null };
  const correct = rows.filter(function (row) { return row.predictedDirection === row.actualDirection; }).length;
  const positives = rows.filter(function (row) { return row.actualDirection === 1; });
  const negatives = rows.filter(function (row) { return row.actualDirection === 0; });
  const truePositiveRate = positives.length ? positives.filter(function (row) { return row.predictedDirection === 1; }).length / positives.length : null;
  const trueNegativeRate = negatives.length ? negatives.filter(function (row) { return row.predictedDirection === 0; }).length / negatives.length : null;
  const balancedAccuracy = truePositiveRate === null || trueNegativeRate === null ? null : (truePositiveRate + trueNegativeRate) / 2;
  return {
    sampleCount: rows.length,
    accuracy: round(correct / rows.length),
    balancedAccuracy: balancedAccuracy === null ? null : round(balancedAccuracy),
    brierScore: round(rows.reduce(function (sum, row) { return sum + (row.upProbability - row.actualDirection) ** 2; }, 0) / rows.length),
    actualUpRate: round(positives.length / rows.length)
  };
}

function evaluateBaselineFold(rows, split) {
  const trainingRows = rowsForRange(rows, split.training);
  const evaluationRows = rowsForRange(rows, split.evaluation);
  const momentum = fitMomentumBaseline(trainingRows);
  const alwaysUp = evaluationRows.map(function (row) {
    return { actualDirection: row.outcome, predictedDirection: 1, upProbability: 1 };
  });
  const conditionalMomentum = evaluationRows.map(function (row) {
    const probability = momentum.bucketProbabilities[momentumBucket(row.feature)];
    return {
      actualDirection: row.outcome,
      predictedDirection: probability >= 0.5 ? 1 : 0,
      upProbability: probability
    };
  });
  return {
    id: split.id,
    training: split.training,
    embargo: split.embargo,
    evaluation: split.evaluation,
    momentumFit: {
      fallbackProbability: round(momentum.fallbackProbability),
      bucketProbabilities: Object.fromEntries(Object.entries(momentum.bucketProbabilities).map(function ([key, value]) { return [key, round(value)]; })),
      bucketSampleCounts: momentum.bucketSampleCounts
    },
    baselines: {
      alwaysUp: metricSummary(alwaysUp),
      conditionalMomentum20d: metricSummary(conditionalMomentum)
    }
  };
}

function aggregateFoldMetrics(folds, key) {
  const total = (folds || []).reduce(function (sum, fold) { return sum + Number(fold?.baselines?.[key]?.sampleCount || 0); }, 0);
  const weighted = function (field) {
    const values = (folds || []).map(function (fold) {
      const metrics = fold?.baselines?.[key];
      return metrics && Number.isFinite(metrics[field]) ? { value: metrics[field], weight: metrics.sampleCount } : null;
    }).filter(Boolean);
    const weight = values.reduce(function (sum, item) { return sum + item.weight; }, 0);
    return weight ? round(values.reduce(function (sum, item) { return sum + item.value * item.weight; }, 0) / weight) : null;
  };
  return { sampleCount: total, accuracy: weighted("accuracy"), balancedAccuracy: weighted("balancedAccuracy"), brierScore: weighted("brierScore"), actualUpRate: weighted("actualUpRate") };
}

function buildBaselineEvaluation(options = {}) {
  const manifest = options.manifest && typeof options.manifest === "object" ? options.manifest : {};
  const rows = mergeFeatureLabels(options.features, options.labels);
  const folds = (Array.isArray(manifest.splits) ? manifest.splits : []).map(function (split) { return evaluateBaselineFold(rows, split); });
  return {
    evaluationVersion: BASELINE_EVALUATION_VERSION,
    splitVersion: manifest.splitVersion || null,
    instrument: manifest.instrument || null,
    featureVersion: manifest.featureVersion || null,
    labelVersion: manifest.labelVersion || null,
    outcome: { horizonTradingDays: manifest.horizonTradingDays || null, definition: "return_20d_percent > 0" },
    baselineDefinitions: {
      alwaysUp: "Always predicts a positive 20-trading-day return with probability 1.",
      conditionalMomentum20d: "Uses only each fold's training rows to estimate positive-return frequency conditional on trailing 20-day return sign."
    },
    folds,
    summary: {
      aggregation: "sample-weighted mean of per-fold metrics; balanced accuracy remains a fold-level diagnostic",
      alwaysUp: aggregateFoldMetrics(folds, "alwaysUp"),
      conditionalMomentum20d: aggregateFoldMetrics(folds, "conditionalMomentum20d")
    }
  };
}

module.exports = {
  BASELINE_EVALUATION_VERSION,
  aggregateFoldMetrics,
  buildBaselineEvaluation,
  evaluateBaselineFold,
  fitMomentumBaseline,
  mergeFeatureLabels,
  metricSummary
};
