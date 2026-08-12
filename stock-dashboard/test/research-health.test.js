const assert = require("node:assert/strict");
const test = require("node:test");
const { parseSupabaseCount } = require("../lib/supabase-server");
const { buildResearchAlerts, sanitizeRun } = require("../lib/research-health");

test("Supabase exact count parser accepts empty and non-empty Content-Range values", function () {
  assert.equal(parseSupabaseCount("0-0/42"), 42);
  assert.equal(parseSupabaseCount("*/0"), 0);
  assert.equal(parseSupabaseCount(null), null);
});

test("research health alerts keep operational details sanitized", function () {
  const alerts = buildResearchAlerts({ latestCapture: { status: "partial" }, pendingOutcomeCount: 2, model: { enabled: false } });
  assert.deepEqual(alerts.map(function (item) { return item.code; }), ["capture_partial", "mature_outcomes_pending", "model_disabled"]);
  assert.equal("errorMessage" in sanitizeRun({ id: "secret-run", error_message: "private", status: "failed" }), false);
  assert.equal("id" in sanitizeRun({ id: "secret-run", status: "failed" }), false);
});
