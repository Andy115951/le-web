import assert from "node:assert/strict";
import test from "node:test";
import { buildDecisionReview, buildDecisionSnapshotComparison } from "../decision-review.mjs";

function entry(id, symbol, action, outcome, marketDate) {
  const timestamp = marketDate + "T16:00:00.000Z";
  return { id, symbol, action, outcome, marketDate, createdAt: timestamp, updatedAt: timestamp };
}

test("decision review distinguishes pending entries from user-recorded outcomes", function () {
  const review = buildDecisionReview([
    entry("a", "NVDA", "bought", "worked", "2026-08-10"),
    entry("b", "NVDA", "hold", "pending", "2026-08-11"),
    entry("c", "AAPL", "watch", "mixed", "2026-08-12"),
    entry("d", "AAPL", "watch", "wrong", "2026-08-13")
  ]);

  assert.equal(review.total, 4);
  assert.equal(review.reviewed, 3);
  assert.deepEqual(review.outcomes, { pending: 1, worked: 1, mixed: 1, wrong: 1 });
  assert.deepEqual(review.actions.map(function (item) { return [item.key, item.total, item.reviewed]; }), [
    ["watch", 2, 2],
    ["bought", 1, 1],
    ["hold", 1, 0]
  ]);
  assert.deepEqual(review.symbols.map(function (item) { return [item.key, item.total, item.reviewed, item.latestMarketDate]; }), [
    ["AAPL", 2, 2, "2026-08-13"],
    ["NVDA", 2, 1, "2026-08-11"]
  ]);
});

test("decision review ignores malformed records through the existing journal normalizer", function () {
  const review = buildDecisionReview([
    entry("valid", "MSFT", "watch", "pending", "2026-08-10"),
    { id: "bad", symbol: "", action: "moon", marketDate: "bad", createdAt: "not-a-date" }
  ]);
  assert.equal(review.total, 1);
  assert.equal(review.outcomes.pending, 1);
  assert.equal(review.symbols[0].key, "MSFT");
});

test("decision review compares only user-recorded before and after snapshots", function () {
  const comparable = entry("pair", "NVDA", "hold", "worked", "2026-08-10");
  comparable.snapshot = { capturedAt: "2026-08-10T16:00:00.000Z", marketDate: "2026-08-10", price: 100, shares: 10, costBasis: 80 };
  comparable.outcomeSnapshot = { capturedAt: "2026-08-15T16:00:00.000Z", marketDate: "2026-08-15", price: 110, shares: 8, costBasis: 80 };
  comparable.outcomeRecordedAt = "2026-08-15T16:00:00.000Z";
  const pending = entry("pending", "AAPL", "watch", "pending", "2026-08-12");
  pending.snapshot = { capturedAt: "2026-08-12T16:00:00.000Z", marketDate: "2026-08-12", price: 200 };

  const comparison = buildDecisionSnapshotComparison(comparable);
  assert.deepEqual(comparison.price, { from: 100, to: 110, change: 10, changePercent: 10 });
  assert.deepEqual(comparison.shares, { from: 10, to: 8, change: -2 });
  assert.equal(buildDecisionSnapshotComparison(pending), null);

  const review = buildDecisionReview([comparable, pending]);
  assert.deepEqual(review.comparisons, {
    completed: 1,
    snapshotComparable: 1,
    priceComparable: 1,
    priceUp: 1,
    priceDown: 0,
    priceFlat: 0,
    sharesComparable: 1
  });
});
