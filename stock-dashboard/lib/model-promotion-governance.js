const PROMOTION_POLICY_VERSION = "qqq-model-promotion-policy-v1";

// This policy is committed before another candidate can be considered. It is
// deliberately stricter than selecting the best-looking historical score.
const PROMOTION_POLICY = Object.freeze({
  policyVersion: PROMOTION_POLICY_VERSION,
  instrument: "QQQ",
  splitVersion: "qqq-walk-forward-v1",
  benchmarkKey: "conditionalMomentum20d",
  minimumFoldCount: 16,
  minimumSampleCount: 900,
  minimumBrierImprovement: 0.005,
  minimumBalancedAccuracyImprovement: 0.005,
  calibration: {
    minimumBinSampleCount: 60,
    maximumAbsoluteError: 0.1
  },
  promotionBoundary: "Passing this offline policy only makes a candidate eligible for human review. It never enables a runtime market signal or investment recommendation."
});

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 6) {
  const parsed = number(value);
  return parsed === null ? null : Number(parsed.toFixed(digits));
}

function check(id, passed, detail) {
  return { id, passed: Boolean(passed), detail };
}

function evaluatePromotion(candidateReport, baselineReport, policy = PROMOTION_POLICY) {
  const candidate = candidateReport && typeof candidateReport === "object" ? candidateReport : {};
  const baseline = baselineReport && typeof baselineReport === "object" ? baselineReport : {};
  const candidateMetrics = candidate.summary?.metrics || {};
  const benchmark = baseline.summary?.[policy.benchmarkKey] || {};
  const candidateBrier = number(candidateMetrics.brierScore);
  const benchmarkBrier = number(benchmark.brierScore);
  const candidateBalancedAccuracy = number(candidateMetrics.balancedAccuracy);
  const benchmarkBalancedAccuracy = number(benchmark.balancedAccuracy);
  const candidateSamples = number(candidateMetrics.sampleCount) || 0;
  const candidateFoldCount = Array.isArray(candidate.folds) ? candidate.folds.length : 0;
  const calibrationBins = Array.isArray(candidate.summary?.calibrationBins) ? candidate.summary.calibrationBins : [];
  const materialCalibrationBins = calibrationBins.filter(function (bin) {
    return (number(bin?.sampleCount) || 0) >= policy.calibration.minimumBinSampleCount;
  });
  const calibrationGaps = materialCalibrationBins.map(function (bin) {
    const predicted = number(bin.averagePredictedProbability);
    const observed = number(bin.observedUpRate);
    return predicted === null || observed === null ? null : Math.abs(predicted - observed);
  });
  const worstCalibrationError = calibrationGaps.length && calibrationGaps.every(function (gap) { return gap !== null; })
    ? Math.max(...calibrationGaps)
    : null;
  const brierImprovement = candidateBrier === null || benchmarkBrier === null ? null : benchmarkBrier - candidateBrier;
  const balancedAccuracyImprovement = candidateBalancedAccuracy === null || benchmarkBalancedAccuracy === null
    ? null
    : candidateBalancedAccuracy - benchmarkBalancedAccuracy;
  const checks = [
    check("matching_frozen_split", candidate.splitVersion === policy.splitVersion, "Candidate split must equal " + policy.splitVersion + "."),
    check("instrument_scope", candidate.instrument === policy.instrument, "Candidate instrument must equal " + policy.instrument + "."),
    check("minimum_folds", candidateFoldCount >= policy.minimumFoldCount, "Requires at least " + policy.minimumFoldCount + " frozen folds; found " + candidateFoldCount + "."),
    check("minimum_samples", candidateSamples >= policy.minimumSampleCount, "Requires at least " + policy.minimumSampleCount + " held-out samples; found " + candidateSamples + "."),
    check("brier_improvement", brierImprovement !== null && brierImprovement >= policy.minimumBrierImprovement, "Requires Brier improvement of at least " + policy.minimumBrierImprovement + " versus " + policy.benchmarkKey + "; observed " + (brierImprovement === null ? "unavailable" : round(brierImprovement)) + "."),
    check("balanced_accuracy_improvement", balancedAccuracyImprovement !== null && balancedAccuracyImprovement >= policy.minimumBalancedAccuracyImprovement, "Requires balanced-accuracy improvement of at least " + policy.minimumBalancedAccuracyImprovement + "; observed " + (balancedAccuracyImprovement === null ? "unavailable" : round(balancedAccuracyImprovement)) + "."),
    check("calibration", worstCalibrationError !== null && worstCalibrationError <= policy.calibration.maximumAbsoluteError, "Requires every calibration bin with at least " + policy.calibration.minimumBinSampleCount + " samples to have absolute error at most " + policy.calibration.maximumAbsoluteError + "; worst observed " + (worstCalibrationError === null ? "unavailable" : round(worstCalibrationError)) + ".")
  ];
  const failedChecks = checks.filter(function (item) { return !item.passed; });
  return {
    policyVersion: policy.policyVersion,
    candidateEvaluationVersion: candidate.evaluationVersion || null,
    benchmarkEvaluationVersion: baseline.evaluationVersion || null,
    reviewStatus: failedChecks.length ? "not_eligible" : "eligible_for_human_review",
    runtimeStatus: "not_deployed",
    promotionBoundary: policy.promotionBoundary,
    policy: {
      instrument: policy.instrument,
      splitVersion: policy.splitVersion,
      benchmarkKey: policy.benchmarkKey,
      minimumFoldCount: policy.minimumFoldCount,
      minimumSampleCount: policy.minimumSampleCount,
      minimumBrierImprovement: policy.minimumBrierImprovement,
      minimumBalancedAccuracyImprovement: policy.minimumBalancedAccuracyImprovement,
      calibration: policy.calibration
    },
    observed: {
      foldCount: candidateFoldCount,
      sampleCount: candidateSamples,
      candidateBrierScore: candidateBrier,
      benchmarkBrierScore: benchmarkBrier,
      brierImprovement: round(brierImprovement),
      candidateBalancedAccuracy,
      benchmarkBalancedAccuracy,
      balancedAccuracyImprovement: round(balancedAccuracyImprovement),
      materialCalibrationBinCount: materialCalibrationBins.length,
      worstCalibrationError: round(worstCalibrationError)
    },
    checks,
    failureLabels: failedChecks.map(function (item) { return item.id; })
  };
}

module.exports = { PROMOTION_POLICY, PROMOTION_POLICY_VERSION, evaluatePromotion };
