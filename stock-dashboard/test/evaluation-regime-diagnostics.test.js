const assert = require("node:assert/strict");
const test = require("node:test");
const { buildEvaluationRegimeDiagnostics, buildFoldRegimeDiagnostic, classifyRegime } = require("../lib/evaluation-regime-diagnostics");

function row(date, close) { return { market_date: date, adjusted_close: close, source: "test" }; }

test("post-hoc regime diagnostics label completed evaluation paths without retaining daily rows", function () {
  const fold = { id: "fold-01", evaluation: { startDate: "2026-01-02", endDate: "2026-01-06", observationCount: 3 } };
  const diagnostic = buildFoldRegimeDiagnostic(fold, [row("2025-12-31", 100), row("2026-01-02", 104), row("2026-01-05", 110), row("2026-01-06", 112)]);
  assert.equal(diagnostic.status, "available");
  assert.equal(diagnostic.regime.label, "volatile");
  assert.equal(diagnostic.regime.metrics.observedTradingDays, 3);
  assert.equal(JSON.stringify(diagnostic).includes("2026-01-05"), false);
});

test("post-hoc diagnostics refuse incomplete price coverage instead of labeling a partial interval", function () {
  const diagnostic = buildFoldRegimeDiagnostic({ id: "fold-01", evaluation: { startDate: "2026-01-02", endDate: "2026-01-06", observationCount: 3 } }, [row("2026-01-02", 100), row("2026-01-06", 90)]);
  assert.equal(diagnostic.status, "unavailable");
  assert.equal("regime" in diagnostic, false);
});

test("regime artifact remains research-only and reports coverage and fixed rules", function () {
  const artifact = buildEvaluationRegimeDiagnostics({ instrument: "QQQ", splitVersion: "split-v1", splits: [{ id: "fold-01", evaluation: { startDate: "2026-01-02", endDate: "2026-01-06", observationCount: 3 } }] }, [row("2025-12-31", 100), row("2026-01-02", 98), row("2026-01-05", 85), row("2026-01-06", 90)], "2026-01-07T00:00:00.000Z");
  assert.equal(artifact.folds[0].regime.label, "stress_drawdown");
  assert.equal(artifact.priceCoverage.rowCount, 4);
  assert.match(artifact.limitations.join(" "), /not inputs to model fitting/);
  assert.equal(classifyRegime({ observedReturnPercent: 10, maximumDrawdownPercent: -2, annualizedVolatilityPercent: 15 }), "strong_uptrend");
  assert.equal(classifyRegime({ observedReturnPercent: 0, maximumDrawdownPercent: 0, annualizedVolatilityPercent: 10 }), "range_bound");
});
