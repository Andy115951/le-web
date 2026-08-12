const { mergeFeatureLabels, metricSummary } = require("./walk-forward-baselines");

const LOGISTIC_EVALUATION_VERSION = "qqq-logistic-evaluation-v1";
const LOGISTIC_MODEL_VERSION = "logistic-regression-l2-v1";
const FEATURE_KEYS = [
  "return_1d_percent",
  "return_5d_percent",
  "return_20d_percent",
  "gap_percent",
  "trailing_volatility_20d_percent",
  "trailing_drawdown_20d_percent",
  "volume_ratio_20d_percent",
  "available_event_count",
  "high_impact_event_count",
  "medium_impact_event_count",
  "low_impact_event_count"
];

function numberAt(feature, key) {
  const camel = key.replace(/_([a-z])/g, function (_match, letter) { return letter.toUpperCase(); });
  const value = feature?.[key] ?? feature?.[camel];
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mean(values) {
  return values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
}

function sampleDeviation(values, average) {
  if (values.length < 2) return null;
  return Math.sqrt(values.reduce(function (sum, value) { return sum + (value - average) ** 2; }, 0) / (values.length - 1));
}

function fitFeatureSchema(rows, options = {}) {
  const minimumSamples = Math.max(10, Number(options.minimumSamples) || 60);
  const stats = FEATURE_KEYS.map(function (key) {
    const values = rows.map(function (row) { return numberAt(row.feature, key); }).filter(function (value) { return value !== null; });
    const average = values.length ? mean(values) : null;
    const deviation = average === null ? null : sampleDeviation(values, average);
    return {
      key,
      sampleCount: values.length,
      mean: average,
      standardDeviation: deviation,
      active: values.length >= minimumSamples && Number.isFinite(deviation) && deviation > 1e-9
    };
  }).filter(function (stat) { return stat.active; });
  return { minimumSamples, stats };
}

function vectorize(feature, schema) {
  return [1].concat(schema.stats.map(function (stat) {
    const raw = numberAt(feature, stat.key);
    return ((raw === null ? stat.mean : raw) - stat.mean) / stat.standardDeviation;
  }));
}

function sigmoid(value) {
  if (value >= 30) return 1;
  if (value <= -30) return 0;
  return 1 / (1 + Math.exp(-value));
}

function fitLogisticRegression(rows, options = {}) {
  const schema = fitFeatureSchema(rows, options);
  if (!schema.stats.length) throw new Error("No stable training features available for logistic regression");
  const iterations = Math.max(50, Math.min(2000, Math.round(Number(options.iterations) || 700)));
  const learningRate = Math.max(0.0001, Math.min(1, Number(options.learningRate) || 0.06));
  const l2Penalty = Math.max(0, Math.min(10, Number(options.l2Penalty) || 0.08));
  const training = rows.map(function (row) { return { vector: vectorize(row.feature, schema), outcome: row.outcome }; });
  const baseRate = mean(training.map(function (row) { return row.outcome; }));
  const intercept = Math.log(Math.max(1e-6, baseRate) / Math.max(1e-6, 1 - baseRate));
  const weights = [intercept].concat(schema.stats.map(function () { return 0; }));
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const gradients = weights.map(function (_value, index) { return index === 0 ? 0 : l2Penalty * weights[index]; });
    training.forEach(function (row) {
      const probability = sigmoid(row.vector.reduce(function (sum, value, index) { return sum + value * weights[index]; }, 0));
      const error = probability - row.outcome;
      row.vector.forEach(function (value, index) { gradients[index] += error * value; });
    });
    weights.forEach(function (_value, index) { weights[index] -= learningRate * gradients[index] / training.length; });
  }
  return {
    modelVersion: LOGISTIC_MODEL_VERSION,
    schema,
    weights,
    options: { iterations, learningRate, l2Penalty },
    trainingSampleCount: training.length
  };
}

function predictLogistic(model, feature) {
  const vector = vectorize(feature, model.schema);
  return sigmoid(vector.reduce(function (sum, value, index) { return sum + value * model.weights[index]; }, 0));
}

function rowsForRange(rows, range) {
  return rows.filter(function (row) { return row.date >= range.startDate && row.date <= range.endDate; });
}

function round(value, digits = 6) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

function calibrationBins(predictions, binCount = 5) {
  const bins = Array.from({ length: binCount }, function (_item, index) {
    return { index, lowerBound: index / binCount, upperBound: (index + 1) / binCount, sampleCount: 0, probabilityTotal: 0, outcomeTotal: 0 };
  });
  predictions.forEach(function (prediction) {
    const index = Math.min(binCount - 1, Math.max(0, Math.floor(prediction.upProbability * binCount)));
    const bin = bins[index];
    bin.sampleCount += 1;
    bin.probabilityTotal += prediction.upProbability;
    bin.outcomeTotal += prediction.actualDirection;
  });
  return bins.map(function (bin) {
    return {
      index: bin.index,
      lowerBound: bin.lowerBound,
      upperBound: bin.upperBound,
      sampleCount: bin.sampleCount,
      averagePredictedProbability: bin.sampleCount ? round(bin.probabilityTotal / bin.sampleCount) : null,
      observedUpRate: bin.sampleCount ? round(bin.outcomeTotal / bin.sampleCount) : null
    };
  });
}

function coefficientMap(model) {
  return Object.fromEntries([["intercept", round(model.weights[0])]].concat(model.schema.stats.map(function (stat, index) {
    return [stat.key, round(model.weights[index + 1])];
  })));
}

function evaluateLogisticFold(rows, split, options) {
  const trainingRows = rowsForRange(rows, split.training);
  const evaluationRows = rowsForRange(rows, split.evaluation);
  const model = fitLogisticRegression(trainingRows, options);
  const predictions = evaluationRows.map(function (row) {
    const upProbability = predictLogistic(model, row.feature);
    return { actualDirection: row.outcome, predictedDirection: upProbability >= 0.5 ? 1 : 0, upProbability };
  });
  return {
    id: split.id,
    training: split.training,
    embargo: split.embargo,
    evaluation: split.evaluation,
    model: {
      version: model.modelVersion,
      trainingSampleCount: model.trainingSampleCount,
      activeFeatureKeys: model.schema.stats.map(function (stat) { return stat.key; }),
      featureMeans: Object.fromEntries(model.schema.stats.map(function (stat) { return [stat.key, round(stat.mean)]; })),
      featureStandardDeviations: Object.fromEntries(model.schema.stats.map(function (stat) { return [stat.key, round(stat.standardDeviation)]; })),
      coefficients: coefficientMap(model),
      options: model.options
    },
    metrics: metricSummary(predictions),
    predictions
  };
}

function buildLogisticEvaluation(options = {}) {
  const manifest = options.manifest && typeof options.manifest === "object" ? options.manifest : {};
  const rows = mergeFeatureLabels(options.features, options.labels);
  const rawFolds = (Array.isArray(manifest.splits) ? manifest.splits : []).map(function (split) {
    return evaluateLogisticFold(rows, split, options);
  });
  const allPredictions = rawFolds.flatMap(function (fold) { return fold.predictions; });
  const folds = rawFolds.map(function (fold) {
    const { predictions, ...summary } = fold;
    return summary;
  });
  return {
    evaluationVersion: LOGISTIC_EVALUATION_VERSION,
    modelVersion: LOGISTIC_MODEL_VERSION,
    deploymentStatus: "research_only_not_selected",
    deploymentReason: "This offline candidate is not wired to the market runtime; promotion requires predefined out-of-sample improvement and calibration review.",
    splitVersion: manifest.splitVersion || null,
    instrument: manifest.instrument || null,
    featureVersion: manifest.featureVersion || null,
    labelVersion: manifest.labelVersion || null,
    outcome: { horizonTradingDays: manifest.horizonTradingDays || null, definition: "return_20d_percent > 0" },
    folds,
    summary: {
      metrics: metricSummary(allPredictions),
      calibrationBins: calibrationBins(allPredictions),
      calibrationBinCount: 5
    }
  };
}

module.exports = {
  FEATURE_KEYS,
  LOGISTIC_EVALUATION_VERSION,
  LOGISTIC_MODEL_VERSION,
  buildLogisticEvaluation,
  calibrationBins,
  fitFeatureSchema,
  fitLogisticRegression,
  predictLogistic
};
