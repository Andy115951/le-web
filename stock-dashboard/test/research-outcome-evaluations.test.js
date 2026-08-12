const assert = require("node:assert/strict");
const test = require("node:test");
const { buildOutcomeRows } = require("../lib/research-outcome-evaluations");

test("mature research outcomes only write snapshots with a mature 20-day label", function () {
  const rows = buildOutcomeRows([{ id: "one", market_date: "2026-01-02" }, { id: "two", market_date: "2026-01-05" }], [{ market_date: "2026-01-02", return_20d_percent: 4.2, max_drawdown_20d_percent: -2.1, realized_volatility_20d_percent: 12, label_version: "labels-v1" }, { market_date: "2026-01-05", return_20d_percent: null }], "2026-02-01T00:00:00.000Z");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].snapshot_id, "one");
  assert.equal(rows[0].realized_return_percent, 4.2);
  assert.equal(rows[0].evaluation_version, "research-outcome-20d-v1");
});

test("existing snapshot evaluations are skipped instead of overwritten", function () {
  const rows = buildOutcomeRows([{ id: "one", market_date: "2026-01-02" }, { id: "two", market_date: "2026-01-05" }], [{ market_date: "2026-01-02", return_20d_percent: 2 }, { market_date: "2026-01-05", return_20d_percent: -1, label_version: "labels-v1" }], "2026-02-01T00:00:00.000Z", new Set(["one"]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].snapshot_id, "two");
  assert.equal(rows[0].maximum_drawdown_percent, null);
});
