const { mergeFeatureLabels, metricSummary } = require("./walk-forward-baselines");
const { FEATURE_KEYS } = require("./walk-forward-logistic");

const TREE_EVALUATION_VERSION = "qqq-tree-evaluation-v1";
const TREE_MODEL_VERSION = "shallow-probability-tree-v1";

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 6) {
  const parsed = finite(value);
  return parsed === null ? null : Number(parsed.toFixed(digits));
}

function valueAt(feature, key) {
  const camel = key.replace(/_([a-z])/g, function (_match, letter) { return letter.toUpperCase(); });
  return finite(feature?.[key] ?? feature?.[camel]);
}

function average(values) {
  return values.length ? values.reduce(function (sum, value) { return sum + value; }, 0) / values.length : null;
}

function sortedValues(rows, key) {
  return rows.map(function (row) { return valueAt(row.feature, key); }).filter(function (value) { return value !== null; }).sort(function (left, right) { return left - right; });
}

function median(values) {
  if (!values.length) return null;
  return values[Math.floor((values.length - 1) / 2)];
}

function featureSchema(rows) {
  return Object.fromEntries(FEATURE_KEYS.map(function (key) {
    return [key, { median: median(sortedValues(rows, key)) }];
  }).filter(function (entry) { return entry[1].median !== null; }));
}

function normalizedValue(row, key, schema) {
  return valueAt(row.feature, key) ?? schema[key]?.median ?? null;
}

function gini(rows) {
  if (!rows.length) return 0;
  const upRate = average(rows.map(function (row) { return row.outcome; }));
  return 1 - upRate ** 2 - (1 - upRate) ** 2;
}

function candidateThresholds(rows, key, schema, count) {
  const values = rows.map(function (row) { return normalizedValue(row, key, schema); }).filter(function (value) { return value !== null; }).sort(function (left, right) { return left - right; });
  const thresholds = new Set();
  for (let index = 1; index < count; index += 1) {
    const position = Math.floor(index * values.length / count);
    const previous = values[Math.max(0, position - 1)];
    const next = values[Math.min(values.length - 1, position)];
    if (previous !== undefined && next !== undefined && previous < next) thresholds.add((previous + next) / 2);
  }
  return [...thresholds];
}

function bestSplit(rows, schema, options) {
  const minimumLeafSamples = options.minimumLeafSamples;
  const parentImpurity = gini(rows);
  let best = null;
  Object.keys(schema).forEach(function (key) {
    candidateThresholds(rows, key, schema, options.thresholdQuantiles).forEach(function (threshold) {
      const left = [];
      const right = [];
      rows.forEach(function (row) { (normalizedValue(row, key, schema) <= threshold ? left : right).push(row); });
      if (left.length < minimumLeafSamples || right.length < minimumLeafSamples) return;
      const weightedImpurity = left.length / rows.length * gini(left) + right.length / rows.length * gini(right);
      const gain = parentImpurity - weightedImpurity;
      if (!best || gain > best.gain || (gain === best.gain && key < best.featureKey)) best = { featureKey: key, threshold, gain, left, right };
    });
  });
  return best && best.gain >= options.minimumGain ? best : null;
}

function leaf(rows, baseRate, smoothing) {
  const upCount = rows.reduce(function (sum, row) { return sum + row.outcome; }, 0);
  return { type: "leaf", sampleCount: rows.length, upCount, probability: (upCount + smoothing * baseRate) / (rows.length + smoothing) };
}

function buildNode(rows, schema, baseRate, options, depth) {
  if (depth >= options.maxDepth || rows.length < options.minimumLeafSamples * 2) return leaf(rows, baseRate, options.smoothing);
  const split = bestSplit(rows, schema, options);
  if (!split) return leaf(rows, baseRate, options.smoothing);
  return {
    type: "split",
    featureKey: split.featureKey,
    threshold: round(split.threshold),
    gain: round(split.gain),
    sampleCount: rows.length,
    left: buildNode(split.left, schema, baseRate, options, depth + 1),
    right: buildNode(split.right, schema, baseRate, options, depth + 1)
  };
}

function normalizeOptions(options = {}) {
  return {
    maxDepth: Math.max(1, Math.min(3, Math.round(Number(options.maxDepth) || 2))),
    minimumLeafSamples: Math.max(15, Math.min(100, Math.round(Number(options.minimumLeafSamples) || 30))),
    thresholdQuantiles: Math.max(4, Math.min(20, Math.round(Number(options.thresholdQuantiles) || 10))),
    minimumGain: Math.max(0, Math.min(0.1, Number(options.minimumGain) || 0.002)),
    smoothing: Math.max(1, Math.min(50, Number(options.smoothing) || 8))
  };
}

function fitProbabilityTree(rows, inputOptions = {}) {
  const options = normalizeOptions(inputOptions);
  const schema = featureSchema(rows);
  if (!Object.keys(schema).length) throw new Error("No usable training features available for probability tree");
  const baseRate = average(rows.map(function (row) { return row.outcome; }));
  return {
    modelVersion: TREE_MODEL_VERSION,
    trainingSampleCount: rows.length,
    schema,
    baseRate,
    options,
    root: buildNode(rows, schema, baseRate, options, 0)
  };
}

function predictProbabilityTree(model, feature) {
  let node = model.root;
  while (node.type === "split") node = normalizedValue({ feature }, node.featureKey, model.schema) <= node.threshold ? node.left : node.right;
  return node.probability;
}

function rowsForRange(rows, range) {
  return rows.filter(function (row) { return row.date >= range.startDate && row.date <= range.endDate; });
}

function calibrationBins(predictions, count = 5) {
  const bins = Array.from({ length: count }, function (_item, index) { return { index, probabilities: [], outcomes: [] }; });
  predictions.forEach(function (prediction) {
    const index = Math.min(count - 1, Math.max(0, Math.floor(prediction.upProbability * count)));
    bins[index].probabilities.push(prediction.upProbability);
    bins[index].outcomes.push(prediction.actualDirection);
  });
  return bins.map(function (bin) {
    return {
      index: bin.index,
      lowerBound: bin.index / count,
      upperBound: (bin.index + 1) / count,
      sampleCount: bin.outcomes.length,
      averagePredictedProbability: round(average(bin.probabilities)),
      observedUpRate: round(average(bin.outcomes))
    };
  });
}

function publicNode(node) {
  if (node.type === "leaf") return { type: node.type, sampleCount: node.sampleCount, upCount: node.upCount, probability: round(node.probability) };
  return { type: node.type, featureKey: node.featureKey, threshold: node.threshold, gain: node.gain, sampleCount: node.sampleCount, left: publicNode(node.left), right: publicNode(node.right) };
}

function evaluateTreeFold(rows, split, options) {
  const trainingRows = rowsForRange(rows, split.training);
  const evaluationRows = rowsForRange(rows, split.evaluation);
  const model = fitProbabilityTree(trainingRows, options);
  const predictions = evaluationRows.map(function (row) {
    const upProbability = predictProbabilityTree(model, row.feature);
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
      activeFeatureKeys: Object.keys(model.schema),
      featureMedians: Object.fromEntries(Object.entries(model.schema).map(function ([key, value]) { return [key, round(value.median)]; })),
      baseRate: round(model.baseRate),
      options: model.options,
      root: publicNode(model.root)
    },
    metrics: metricSummary(predictions),
    predictions
  };
}

function buildTreeEvaluation(options = {}) {
  const manifest = options.manifest && typeof options.manifest === "object" ? options.manifest : {};
  const rows = mergeFeatureLabels(options.features, options.labels);
  const rawFolds = (Array.isArray(manifest.splits) ? manifest.splits : []).map(function (split) { return evaluateTreeFold(rows, split, options); });
  const predictions = rawFolds.flatMap(function (fold) { return fold.predictions; });
  return {
    evaluationVersion: TREE_EVALUATION_VERSION,
    modelVersion: TREE_MODEL_VERSION,
    deploymentStatus: "research_only_not_selected",
    deploymentReason: "This offline candidate is never wired to the market runtime until it clears the fixed promotion policy and human review.",
    splitVersion: manifest.splitVersion || null,
    instrument: manifest.instrument || null,
    featureVersion: manifest.featureVersion || null,
    labelVersion: manifest.labelVersion || null,
    outcome: { horizonTradingDays: manifest.horizonTradingDays || null, definition: "return_20d_percent > 0" },
    folds: rawFolds.map(function (fold) { const { predictions: _predictions, ...summary } = fold; return summary; }),
    summary: { metrics: metricSummary(predictions), calibrationBins: calibrationBins(predictions), calibrationBinCount: 5 }
  };
}

module.exports = { TREE_EVALUATION_VERSION, TREE_MODEL_VERSION, buildTreeEvaluation, fitProbabilityTree, predictProbabilityTree };
