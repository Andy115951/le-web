function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 6) {
  const parsed = number(value);
  return parsed === null ? null : Number(parsed.toFixed(digits));
}

function getMomentumMetrics(fold) {
  return fold?.baselines?.conditionalMomentum20d || null;
}

function classifyFailure(candidateMetrics, benchmarkMetrics) {
  const candidateBrier = number(candidateMetrics?.brierScore);
  const benchmarkBrier = number(benchmarkMetrics?.brierScore);
  const candidateBalanced = number(candidateMetrics?.balancedAccuracy);
  const benchmarkBalanced = number(benchmarkMetrics?.balancedAccuracy);
  const probabilityGap = candidateBrier === null || benchmarkBrier === null ? null : candidateBrier - benchmarkBrier;
  const directionGap = candidateBalanced === null || benchmarkBalanced === null ? null : candidateBalanced - benchmarkBalanced;
  const labels = [];
  if (probabilityGap !== null && probabilityGap > 0) labels.push("probability_degradation");
  if (directionGap !== null && directionGap < 0) labels.push("direction_degradation");
  return { probabilityGap: round(probabilityGap), directionGap: round(directionGap), labels };
}

function buildFailureCaseSummary(candidateReport, baselineReport, options = {}) {
  const candidateFolds = Array.isArray(candidateReport?.folds) ? candidateReport.folds : [];
  const baselineById = new Map((Array.isArray(baselineReport?.folds) ? baselineReport.folds : []).map(function (fold) { return [fold.id, fold]; }));
  const maxCases = Math.max(1, Math.min(16, Math.round(Number(options.maxCases) || 5)));
  const regimes = options.regimeByFold instanceof Map ? options.regimeByFold : new Map();
  const cases = candidateFolds.map(function (fold) {
    const baseline = baselineById.get(fold.id);
    const comparison = classifyFailure(fold.metrics, getMomentumMetrics(baseline));
    return {
      foldId: fold.id || null,
      evaluation: fold.evaluation || null,
      labels: comparison.labels,
      candidate: {
        brierScore: number(fold.metrics?.brierScore),
        balancedAccuracy: number(fold.metrics?.balancedAccuracy)
      },
      benchmark: {
        brierScore: number(getMomentumMetrics(baseline)?.brierScore),
        balancedAccuracy: number(getMomentumMetrics(baseline)?.balancedAccuracy)
      },
      probabilityGap: comparison.probabilityGap,
      directionGap: comparison.directionGap,
      posthocRegime: regimes.get(fold.id) || null
    };
  }).filter(function (item) { return item.labels.length; });
  cases.sort(function (left, right) {
    const leftSeverity = Math.max(0, left.probabilityGap || 0) + Math.max(0, -(left.directionGap || 0));
    const rightSeverity = Math.max(0, right.probabilityGap || 0) + Math.max(0, -(right.directionGap || 0));
    return rightSeverity - leftSeverity || String(left.foldId).localeCompare(String(right.foldId));
  });
  return {
    scope: "fold_level_only",
    limitation: "Cases compare frozen evaluation-period aggregates. They intentionally exclude individual predictions, current probabilities, and trading instructions.",
    evaluatedFoldCount: candidateFolds.length,
    failureCaseCount: cases.length,
    posthocRegimeDiagnosticVersion: options.regimeDiagnosticVersion || null,
    regimeCounts: cases.reduce(function (result, item) {
      const label = item.posthocRegime?.label || "unavailable";
      result[label] = (result[label] || 0) + 1;
      return result;
    }, {}),
    labelCounts: cases.reduce(function (result, item) {
      item.labels.forEach(function (label) { result[label] = (result[label] || 0) + 1; });
      return result;
    }, {}),
    cases: cases.slice(0, maxCases)
  };
}

module.exports = { buildFailureCaseSummary, classifyFailure };
