const assert = require("node:assert/strict");
const test = require("node:test");
const officialSnapshot = require("../data/ndx/2026-05-01.json");
const {
  getNdxConstituentChangeSummary,
  normalizeAsOf,
  normalizeNdxConstituentChanges,
  validateSnapshot
} = require("../lib/ndx-snapshots");

test("official NDX snapshot has a complete unique rounded-weight universe", function () {
  const snapshot = validateSnapshot(officialSnapshot);
  assert.equal(snapshot.indexSymbol, "NDX");
  assert.equal(snapshot.effectiveDate, "2026-05-01");
  assert.equal(snapshot.constituents.length, 101);
  assert.equal(new Set(snapshot.constituents.map(function (item) { return item.symbol; })).size, 101);
  assert.equal(snapshot.totalWeightPercent, 99.96);
  assert.equal(snapshot.sourceUrl, "https://www.nasdaq.com/docs/2026/05/04/NDX.pdf");
});

test("snapshot validation rejects duplicate symbols and implausible weight totals", function () {
  const duplicate = structuredClone(officialSnapshot);
  duplicate.constituents[1].symbol = duplicate.constituents[0].symbol;
  assert.throws(function () { validateSnapshot(duplicate); }, /Duplicate NDX symbol/);

  const badTotal = structuredClone(officialSnapshot);
  badTotal.constituents.forEach(function (item) { item.weightPercent /= 2; });
  assert.throws(function () { validateSnapshot(badTotal); }, /approximately 100/);
});

test("as-of normalization accepts ISO dates and safely defaults invalid input", function () {
  assert.equal(normalizeAsOf("2026-05-01"), "2026-05-01");
  assert.match(normalizeAsOf(), /^\d{4}-\d{2}-\d{2}$/);
  assert.throws(function () { normalizeAsOf("05/01/2026"); }, /Invalid as-of date/);
});

test("NDX constituent changes normalize to a safe deterministic public shape", function () {
  const changes = normalizeNdxConstituentChanges([
    { change_kind: "weight_changed", previous_weight_percent: "4.2", current_weight_percent: "4.8", instruments: { symbol: "MSFT", display_name: "Microsoft" } },
    { change_kind: "membership_removed", previous_weight_percent: "0.4", current_weight_percent: null, instruments: { symbol: "OLD", display_name: "Old Corp" } },
    { change_kind: "membership_added", previous_weight_percent: null, current_weight_percent: "0.5", instruments: { symbol: "NEW", display_name: "New Corp" } },
    { change_kind: "unknown", instruments: { symbol: "SKIP" } }
  ]);
  assert.deepEqual(changes.map(function (change) { return change.symbol; }), ["NEW", "OLD", "MSFT"]);
  assert.equal(changes[2].weightChangePercent, 0.6);
  assert.equal(changes[0].previousWeightPercent, null);
});

test("NDX constituent change summary distinguishes the first snapshot from recorded changes", async function () {
  const snapshot = { id: 22, index_symbol: "NDX", effective_date: "2026-08-01" };
  const withChanges = await getNdxConstituentChangeSummary(snapshot, {}, async function (_config, path) {
    if (path.includes("ndx_constituent_snapshots")) return [{ effective_date: "2026-05-01" }];
    return [
      { change_kind: "membership_added", previous_weight_percent: null, current_weight_percent: "0.5", instruments: { symbol: "NEW", display_name: "New Corp" } },
      { change_kind: "weight_changed", previous_weight_percent: "4", current_weight_percent: "4.6", instruments: { symbol: "MSFT", display_name: "Microsoft" } }
    ];
  });
  assert.equal(withChanges.status, "changes_recorded");
  assert.equal(withChanges.baselineEffectiveDate, "2026-05-01");
  assert.deepEqual(withChanges.summary, { total: 2, membershipAdded: 1, membershipRemoved: 0, weightChanged: 1 });

  const first = await getNdxConstituentChangeSummary(snapshot, {}, async function () { return []; });
  assert.equal(first.status, "first_snapshot");
  assert.equal(first.summary.total, 0);
});
