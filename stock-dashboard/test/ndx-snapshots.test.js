const assert = require("node:assert/strict");
const test = require("node:test");
const officialSnapshot = require("../data/ndx/2026-05-01.json");
const { normalizeAsOf, validateSnapshot } = require("../lib/ndx-snapshots");

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
