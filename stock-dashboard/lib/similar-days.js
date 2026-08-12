const SIMILARITY_METHOD_VERSION = "qqq-price-state-v1";
const MIN_NORMALIZATION_SAMPLES = 60;
const MIN_CANDIDATE_SEPARATION = 20;
const OUTCOME_HORIZON = 20;

const COMPONENTS = [
  { key: "momentum", weight: 0.5, fields: ["return1dPercent", "return5dPercent", "return20dPercent", "gapPercent"] },
  { key: "risk", weight: 0.35, fields: ["trailingVolatility20dPercent", "trailingDrawdown20dPercent"] },
  { key: "participation", weight: 0.15, fields: ["volumeRatio20dPercent"] },
  { key: "event", weight: 0.1, fields: ["availableEventCount", "highImpactEventCount", "mediumImpactEventCount", "lowImpactEventCount", "eventTickerCount"] }
];

const FIELD_ALIASES = {
  return1dPercent: ["return1dPercent", "return_1d_percent"],
  return5dPercent: ["return5dPercent", "return_5d_percent"],
  return20dPercent: ["return20dPercent", "return_20d_percent"],
  gapPercent: ["gapPercent", "gap_percent"],
  trailingVolatility20dPercent: ["trailingVolatility20dPercent", "trailing_volatility_20d_percent"],
  trailingDrawdown20dPercent: ["trailingDrawdown20dPercent", "trailing_drawdown_20d_percent"],
  volumeRatio20dPercent: ["volumeRatio20dPercent", "volume_ratio_20d_percent"],
  availableEventCount: ["availableEventCount", "available_event_count"],
  highImpactEventCount: ["highImpactEventCount", "high_impact_event_count"],
  mediumImpactEventCount: ["mediumImpactEventCount", "medium_impact_event_count"],
  lowImpactEventCount: ["lowImpactEventCount", "low_impact_event_count"],
  eventTickerCount: ["eventTickerCount", "event_ticker_count"]
};

function round(value, digits = 6) {
  return Number(Number(value).toFixed(digits));
}

function marketDateOf(row) {
  return String(row?.marketDate || row?.market_date || "");
}

function numberOf(row, key) {
  const value = FIELD_ALIASES[key].map(function (alias) { return row?.[alias]; }).find(function (item) {
    return item !== null && item !== undefined && item !== "";
  });
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mean(values) {
  return values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
}

function sampleDeviation(values, average) {
  if (values.length < 2) return null;
  const variance = values.reduce(function (sum, value) { return sum + ((value - average) ** 2); }, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function fitNormalizers(features, targetIndex) {
  const history = features.slice(0, targetIndex);
  const normalizers = {};
  COMPONENTS.forEach(function (component) {
    component.fields.forEach(function (key) {
      const values = history.map(function (feature) { return numberOf(feature, key); }).filter(function (value) { return value !== null; });
      const average = values.length ? mean(values) : null;
      const deviation = average === null ? null : sampleDeviation(values, average);
      normalizers[key] = {
        sampleCount: values.length,
        mean: average,
        deviation,
        active: values.length >= MIN_NORMALIZATION_SAMPLES && Number.isFinite(deviation) && deviation > 1e-9
      };
    });
  });
  return { history, normalizers };
}

function componentScore(target, candidate, component, normalizers) {
  const distances = [];
  const usedKeys = [];
  component.fields.forEach(function (key) {
    const normalizer = normalizers[key];
    const targetValue = numberOf(target, key);
    const candidateValue = numberOf(candidate, key);
    if (!normalizer?.active || targetValue === null || candidateValue === null) return;
    distances.push((targetValue - candidateValue) / normalizer.deviation);
    usedKeys.push(key);
  });
  if (!distances.length) return { score: null, usedKeys: [] };
  const distance = Math.sqrt(distances.reduce(function (sum, value) { return sum + value * value; }, 0) / distances.length);
  return { score: round(100 / (1 + distance)), usedKeys };
}

function labelNumber(label, camel, snake) {
  const value = label?.[camel] ?? label?.[snake];
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function candidateOutcome(label) {
  return {
    return1dPercent: labelNumber(label, "return1dPercent", "return_1d_percent"),
    return3dPercent: labelNumber(label, "return3dPercent", "return_3d_percent"),
    return5dPercent: labelNumber(label, "return5dPercent", "return_5d_percent"),
    return20dPercent: labelNumber(label, "return20dPercent", "return_20d_percent"),
    maxDrawdown20dPercent: labelNumber(label, "maxDrawdown20dPercent", "max_drawdown_20d_percent"),
    realizedVolatility20dPercent: labelNumber(label, "realizedVolatility20dPercent", "realized_volatility_20d_percent")
  };
}

function findSimilarDays(options) {
  const features = [...(options?.features || [])].sort(function (left, right) { return marketDateOf(left).localeCompare(marketDateOf(right)); });
  const targetDate = String(options?.targetDate || "");
  const targetIndex = features.findIndex(function (feature) { return marketDateOf(feature) === targetDate; });
  if (targetIndex < 0) throw new Error("Target feature date is not available");
  const target = features[targetIndex];
  const maxResults = Math.min(10, Math.max(1, Number(options?.maxResults) || 5));
  const minimumSeparation = Math.max(1, Number(options?.minimumSeparation) || MIN_CANDIDATE_SEPARATION);
  const maturityHorizon = Math.max(1, Number(options?.maturityHorizon) || OUTCOME_HORIZON);
  const { history, normalizers } = fitNormalizers(features, targetIndex);
  const activeFeatureKeys = {};
  COMPONENTS.forEach(function (component) {
    activeFeatureKeys[component.key] = component.fields.filter(function (key) { return normalizers[key]?.active; });
  });
  const activeComponentCount = Object.values(activeFeatureKeys).filter(function (keys) { return keys.length > 0; }).length;
  if (history.length < MIN_NORMALIZATION_SAMPLES || activeComponentCount === 0) {
    return {
      target,
      targetIndex,
      matches: [],
      methodVersion: SIMILARITY_METHOD_VERSION,
      normalization: { sampleCount: history.length, startDate: history[0] ? marketDateOf(history[0]) : null, endDate: history.at(-1) ? marketDateOf(history.at(-1)) : null, activeFeatureKeys },
      reason: "Insufficient historical feature variation"
    };
  }

  const labelsByDate = new Map((options?.labels || []).map(function (label) { return [marketDateOf(label), label]; }));
  const candidates = history.map(function (candidate, candidateIndex) {
    if (candidateIndex + maturityHorizon > targetIndex) return null;
    const label = labelsByDate.get(marketDateOf(candidate));
    if (candidateOutcome(label).return20dPercent === null) return null;
    const componentResults = COMPONENTS.map(function (component) {
      return { key: component.key, weight: component.weight, ...componentScore(target, candidate, component, normalizers) };
    }).filter(function (result) { return result.score !== null; });
    if (!componentResults.length) return null;
    const totalWeight = componentResults.reduce(function (sum, result) { return sum + result.weight; }, 0);
    const score = componentResults.reduce(function (sum, result) { return sum + result.score * result.weight; }, 0) / totalWeight;
    return {
      candidate,
      candidateIndex,
      score: round(score),
      components: Object.fromEntries(componentResults.map(function (result) { return [result.key, result.score]; })),
      usedFeatureKeys: Object.fromEntries(componentResults.map(function (result) { return [result.key, result.usedKeys]; })),
      outcome: candidateOutcome(label)
    };
  }).filter(Boolean).sort(function (left, right) {
    return right.score - left.score || marketDateOf(right.candidate).localeCompare(marketDateOf(left.candidate));
  });

  const selected = [];
  candidates.forEach(function (candidate) {
    if (selected.length >= maxResults) return;
    if (selected.some(function (existing) { return Math.abs(existing.candidateIndex - candidate.candidateIndex) < minimumSeparation; })) return;
    selected.push(candidate);
  });

  return {
    target,
    targetIndex,
    matches: selected.map(function (match, index) { return { rank: index + 1, ...match }; }),
    methodVersion: SIMILARITY_METHOD_VERSION,
    normalization: {
      sampleCount: history.length,
      startDate: marketDateOf(history[0]),
      endDate: marketDateOf(history.at(-1)),
      activeFeatureKeys
    },
    reason: selected.length ? null : "No mature, sufficiently separated candidates"
  };
}

module.exports = {
  COMPONENTS,
  MIN_CANDIDATE_SEPARATION,
  MIN_NORMALIZATION_SAMPLES,
  OUTCOME_HORIZON,
  SIMILARITY_METHOD_VERSION,
  findSimilarDays
};
