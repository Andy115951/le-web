const assert = require("node:assert/strict");
const test = require("node:test");
const {
  EVENT_REVIEW_VERSION,
  applyReviewDecisionsToEvents,
  buildEventReviewFocus,
  buildEventReviewQueue,
  buildEventReviewTriage,
  classifyEventForReview,
  normalizeReviewDecision
} = require("../lib/event-review");
const { buildReviewFocus, buildReviewSummary } = require("../scripts/review-unified-events");

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

test("review triage aggregates only attention candidates without disclosing source details", function () {
  const triage = buildEventReviewTriage([{
    eventType: "market_move_attribution",
    classification: { flags: [{ code: "low_confidence", severity: "medium" }, { code: "missing_known_at", severity: "high" }] }
  }, {
    eventType: "market_move_attribution",
    classification: { flags: [{ code: "low_confidence", severity: "medium" }] },
    sources: [{ canonical_url: "https://private.example" }]
  }, {
    eventType: "sec_filing",
    classification: { flags: [{ code: "missing_known_at", severity: "high" }] }
  }]);
  assert.equal(triage.attentionCount, 3);
  assert.deepEqual(triage.byFlag, [
    { code: "low_confidence", severity: "medium", count: 2 },
    { code: "missing_known_at", severity: "high", count: 2 }
  ]);
  assert.deepEqual(triage.byEventType, [
    { eventType: "market_move_attribution", count: 2 },
    { eventType: "sec_filing", count: 1 }
  ]);
  assert.equal(JSON.stringify(triage).includes("private.example"), false);
});

test("review summary is bounded to queue counts and safe triage fields", function () {
  const summary = buildReviewSummary({
    version: "event-review-v1",
    days: 30,
    totalCount: 42,
    needsAttentionCount: 12,
    unreviewedCount: 33,
    triage: {
      attentionCount: 12,
      byFlag: [{ code: "low_confidence", severity: "medium", count: 12 }],
      byEventType: [{ eventType: "market_move_attribution", count: 12 }]
    },
    items: [{ title: "Must not be included", sources: [{ url: "https://private.example" }] }]
  });
  assert.deepEqual(summary, {
    version: "event-review-v1",
    days: 30,
    totalCount: 42,
    needsAttentionCount: 12,
    unreviewedCount: 33,
    triage: {
      attentionCount: 12,
      byFlag: [{ code: "low_confidence", severity: "medium", count: 12 }],
      byEventType: [{ eventType: "market_move_attribution", count: 12 }]
    }
  });
  assert.equal(JSON.stringify(summary).includes("private.example"), false);
  assert.equal(JSON.stringify(summary).includes("Must not be included"), false);
});

test("review focus selects bounded high-risk candidates without including resolved entries", function () {
  const queue = buildEventReviewQueue([{
    id: "high",
    event_key: "market-move:high",
    market_date: "2026-09-02",
    event_type: "market_move_attribution",
    title: "High priority review",
    confidence: 0.4,
    sources: [{ relationType: "primary", provider: "Example", title: "Primary evidence", canonical_url: "https://example.test/high" }]
  }, {
    id: "medium",
    event_key: "market-move:medium",
    market_date: "2026-09-01",
    event_type: "market_move_attribution",
    title: "Medium priority review",
    available_at: "2026-09-01T20:00:00.000Z",
    confidence: 0.65,
    sources: [{ relationType: "primary", provider: "Example", title: "Primary evidence", canonical_url: "https://example.test/medium" }]
  }, {
    id: "resolved",
    event_key: "market-move:resolved",
    market_date: "2026-09-03",
    event_type: "market_move_attribution",
    title: "Resolved entry",
    confidence: 0.4,
    sources: [{ relationType: "primary", provider: "Example", title: "Primary evidence", canonical_url: "https://example.test/resolved" }]
  }], new Map([["resolved", { review_status: "accepted", review_version: EVENT_REVIEW_VERSION }]]), 30);
  const focus = buildEventReviewFocus(queue.items, 1);
  assert.equal(focus.totalCandidates, 2);
  assert.equal(focus.maximumCount, 1);
  assert.deepEqual(focus.items.map(function (item) { return item.eventKey; }), ["market-move:high"]);
  assert.equal(focus.items[0].primarySource.url, "https://example.test/high");
  assert.deepEqual(queue.priorityEventKeys, ["market-move:high", "market-move:medium"]);

  const cliFocus = buildReviewFocus(queue, 99);
  assert.equal(cliFocus.days, 30);
  assert.equal(cliFocus.focus.maximumCount, 20);
  assert.equal(cliFocus.focus.items.some(function (item) { return item.eventKey === "market-move:resolved"; }), false);
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

test("archived rule labels take precedence over live fallback rules without overriding human decisions", function () {
  const events = [{
    id: "event-1",
    event_type: "sec_filing",
    confidence: 0.95,
    available_at: "2026-08-11T20:00:00.000Z",
    sources: [{ relationType: "primary" }]
  }];
  const labels = new Map([["event-1", {
    label_version: "event-labeler-agent-v1",
    suggested_status: "needs_attention",
    requires_review: true,
    flags: [{ code: "missing_known_at", severity: "high" }]
  }]]);
  const accepted = applyReviewDecisionsToEvents(events, new Map([["event-1", {
    review_status: "accepted",
    review_version: EVENT_REVIEW_VERSION,
    reviewed_at: "2026-08-12T00:00:00.000Z"
  }]]), labels);
  assert.equal(accepted[0].review.status, "accepted");
  assert.equal(accepted[0].review.requiresAttention, true);
  assert.equal(accepted[0].review.version, EVENT_REVIEW_VERSION);
  assert.deepEqual(accepted[0].review.flags, [{ code: "missing_known_at", severity: "high" }]);
});
