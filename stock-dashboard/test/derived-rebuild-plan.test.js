const assert = require("node:assert/strict");
const test = require("node:test");
const { DERIVED_REBUILD_STAGES, buildDerivedRebuildPlan, parseDerivedRebuildArgs, runDerivedRebuild } = require("../lib/derived-rebuild-plan");

test("derived rebuild requires explicit approval in its command input", function () {
  assert.deepEqual(parseDerivedRebuildArgs([]), { symbol: "QQQ", approved: false });
  assert.deepEqual(parseDerivedRebuildArgs(["qqq", "--approve"]), { symbol: "QQQ", approved: true });
  assert.throws(function () { parseDerivedRebuildArgs(["QQQ", "NVDA"]); }, /at most one symbol/);
  const plan = buildDerivedRebuildPlan("qqq");
  assert.equal(plan.writesDatabase, true);
  assert.equal(plan.requiresExplicitApproval, true);
  assert.deepEqual(plan.stages, DERIVED_REBUILD_STAGES);
});

test("derived rebuild preserves feature-label-similar dependency order", async function () {
  const calls = [];
  const result = await runDerivedRebuild("QQQ", {
    rebuildFeatures: async function (symbol) { calls.push("features:" + symbol); return { featuresWritten: 2 }; },
    rebuildLabels: async function (symbol) { calls.push("labels:" + symbol); return { labelsWritten: 2 }; },
    rebuildSimilarDays: async function (symbol) { calls.push("similar:" + symbol); return { matchesWritten: 5 }; }
  });
  assert.deepEqual(calls, ["features:QQQ", "labels:QQQ", "similar:QQQ"]);
  assert.deepEqual(result, { symbol: "QQQ", features: { featuresWritten: 2 }, labels: { labelsWritten: 2 }, similarDays: { matchesWritten: 5 } });
});
