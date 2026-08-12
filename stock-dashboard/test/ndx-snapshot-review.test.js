const assert = require("node:assert/strict");
const test = require("node:test");
const officialSnapshot = require("../data/ndx/2026-05-01.json");
const { compareNdxSnapshots, hasMaterialMembershipChange, snapshotsEquivalent, toConstituentChangeRows } = require("../lib/ndx-snapshot-review");

function makeCandidate() {
  const candidate = structuredClone(officialSnapshot);
  candidate.effectiveDate = "2026-06-01";
  candidate.publishedAt = "2026-06-02T00:00:00.000Z";
  candidate.sourceUrl = "https://www.nasdaq.com/docs/2026/06/02/NDX.pdf";
  return candidate;
}

test("NDX review reports membership and weight differences deterministically", function () {
  const candidate = makeCandidate();
  const removed = candidate.constituents.find(function (item) { return item.symbol === "ADBE"; });
  removed.symbol = "NEWSYM";
  removed.name = "NEW SYMBOL INC.";
  candidate.constituents.find(function (item) { return item.symbol === "AAPL"; }).weightPercent += 0.1;
  candidate.constituents.find(function (item) { return item.symbol === "MSFT"; }).weightPercent -= 0.1;

  const review = compareNdxSnapshots(officialSnapshot, candidate);
  assert.deepEqual(review.added.map(function (item) { return item.symbol; }), ["NEWSYM"]);
  assert.deepEqual(review.removed.map(function (item) { return item.symbol; }), ["ADBE"]);
  assert.equal(review.summary.addedCount, 1);
  assert.equal(review.summary.removedCount, 1);
  assert.equal(review.summary.weightChangeCount, 2);
  assert.equal(review.summary.grossWeightChangePercent, 0.2);
  assert.equal(hasMaterialMembershipChange(review), true);
  assert.deepEqual(review.weightChanges.map(function (item) { return item.symbol; }), ["AAPL", "MSFT"]);
});

test("NDX review rejects a candidate that is not chronologically newer", function () {
  const candidate = makeCandidate();
  candidate.effectiveDate = officialSnapshot.effectiveDate;
  assert.throws(function () { compareNdxSnapshots(officialSnapshot, candidate); }, /after the baseline/);
});

test("NDX snapshot equality only permits an exact idempotent re-import", function () {
  const same = structuredClone(officialSnapshot);
  const changed = structuredClone(officialSnapshot);
  changed.constituents.find(function (item) { return item.symbol === "AAPL"; }).weightPercent += 0.01;
  changed.constituents.find(function (item) { return item.symbol === "MSFT"; }).weightPercent -= 0.01;
  assert.equal(snapshotsEquivalent(officialSnapshot, same), true);
  assert.equal(snapshotsEquivalent(officialSnapshot, changed), false);
});

test("NDX review maps added, removed and weight changes into append-only event rows", function () {
  const candidate = makeCandidate();
  const replaced = candidate.constituents.find(function (item) { return item.symbol === "ADBE"; });
  replaced.symbol = "NEWSYM";
  replaced.name = "NEW SYMBOL INC.";
  candidate.constituents.find(function (item) { return item.symbol === "AAPL"; }).weightPercent += 0.1;
  candidate.constituents.find(function (item) { return item.symbol === "MSFT"; }).weightPercent -= 0.1;
  const review = compareNdxSnapshots(officialSnapshot, candidate);
  const ids = new Map([["ADBE", 1], ["NEWSYM", 2], ["AAPL", 3], ["MSFT", 4]]);
  const rows = toConstituentChangeRows(review, 20, 10, ids, "2026-06-02T00:00:00.000Z");
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map(function (row) { return row.change_kind; }).sort(), [
    "membership_added",
    "membership_removed",
    "weight_changed",
    "weight_changed"
  ]);
  assert.ok(rows.every(function (row) { return row.snapshot_id === 20 && row.prior_snapshot_id === 10; }));
});
