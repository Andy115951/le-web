const assert = require("node:assert/strict");
const test = require("node:test");
const {
  EVENT_REVIEW_VERSION,
  applyReviewDecisionsToEvents,
  buildEventReviewQueue,
  classifyEventForReview,
  normalizeReviewDecision
} = require("../lib/event-review");

test("event review classifier sends heuristic or weak evidence to manual review", function () {
  const attribution = classifyEventForReview({
    event_type: "market_move_attribution",
    confidence: 0.65,
    available_at: "2026-08-11T20:00:00.000Z",
    sources: [{ relationType: "primary" }]
  });
  assert.equal(attribution.version, EVENT_REVIEW_VERSION);
  assert.equal(attribution.requiresReview, true);
  assert.deepEqual(attribution.flags.map(function (flag) { return flag.code; }), ["low_confidence", "heuristic_market_attribution"]);

  const official = classifyEventForReview({
    event_type: "sec_filing",
    confidence: 0.95,
    available_at: "2026-08-11T20:00:00.000Z",
    sources: [{ relationType: "primary" }]
  });
  assert.equal(official.requiresReview, false);
  assert.equal(official.suggestedStatus, "accepted");
});

test("event review decisions are constrained and do not accept an anonymous reviewer", function () {
  assert.deepEqual(normalizeReviewDecision({
    eventKey: "sec-filing:123:NVDA",
    reviewStatus: "accepted",
    reviewer: "apple",
    reviewNote: "Primary filing was checked."
  }), {
    eventKey: "sec-filing:123:NVDA",
    reviewStatus: "accepted",
    reviewer: "apple",
    reviewNote: "Primary filing was checked."
  });
  assert.throws(function () {
    normalizeReviewDecision({ eventKey: "key", reviewStatus: "accept", reviewer: "a" });
  }, /reviewStatus/);
  assert.throws(function () {
    normalizeReviewDecision({ eventKey: "key", reviewStatus: "accepted", reviewer: "a" });
  }, /reviewer/);
});

test("review queue keeps unreviewed counts separate from deterministic attention flags", function () {
  const result = buildEventReviewQueue([{
    id: "event-1",
    event_key: "market-move:2026-08-11:QQQ:v1",
    market_date: "2026-08-11",
    event_type: "market_move_attribution",
    title: "QQQ daily market move",
    available_at: "2026-08-11T20:00:00.000Z",
    confidence: 0.65,
    sources: [{ relationType: "primary" }]
  }, {
    id: "event-2",
    event_key: "sec-filing:123:NVDA",
    market_date: "2026-08-11",
    event_type: "sec_filing",
    title: "NVDA filed 8-K",
    available_at: "2026-08-11T20:00:00.000Z",
    confidence: 0.95,
    sources: [{ relationType: "primary" }]
  }], new Map([["event-2", {
    review_status: "accepted",
    reviewer: "apple",
    review_note: "Checked.",
    review_version: EVENT_REVIEW_VERSION,
    reviewed_at: "2026-08-12T00:00:00.000Z"
  }]]), 30);
  assert.equal(result.needsAttentionCount, 1);
  assert.equal(result.unreviewedCount, 1);
  assert.equal(result.items[0].queueState, "needs_attention");
  assert.equal(result.items[1].queueState, "accepted");
  assert.equal("reviewer" in result.items[1].latestReview, false);
  assert.equal("note" in result.items[1].latestReview, false);
});

test("review application attaches only public decision state to research events", function () {
  const events = [{
    id: "event-1",
    event_type: "sec_filing",
    confidence: 0.95,
    available_at: "2026-08-11T20:00:00.000Z",
    sources: [{ relationType: "primary" }]
  }];
  const result = applyReviewDecisionsToEvents(events, new Map([["event-1", {
    review_status: "rejected",
    reviewer: "apple",
    review_note: "Sensitive private note",
    review_version: EVENT_REVIEW_VERSION,
    reviewed_at: "2026-08-12T00:00:00.000Z"
  }]]));
  assert.equal(result[0].review.status, "rejected");
  assert.equal(result[0].review.requiresAttention, false);
  assert.equal("reviewer" in result[0].review, false);
  assert.equal("reviewNote" in result[0].review, false);
});
