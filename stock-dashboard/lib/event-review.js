const { getSupabaseConfig, requestSupabase } = require("./supabase-server");
const { getUnifiedMarketEvents, normalizeHistoryDays } = require("./unified-market-events");

const EVENT_REVIEW_VERSION = "event-review-rules-v1";
const REVIEW_STATUSES = new Set(["accepted", "rejected", "needs_attention"]);

function boundedText(value, maximum) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function classifyEventForReview(event) {
  const sources = Array.isArray(event?.sources) ? event.sources : [];
  const flags = [];
  const confidence = Number(event?.confidence);
  const primarySourceCount = sources.filter(function (source) { return source?.relationType === "primary"; }).length;
  if (!sources.length || !primarySourceCount) flags.push({ code: "missing_primary_source", severity: "high" });
  if (!Number.isFinite(confidence) || confidence < 0.7) flags.push({ code: "low_confidence", severity: "medium" });
  if (!event?.available_at && !event?.availableAt) flags.push({ code: "missing_known_at", severity: "high" });
  if (event?.event_type === "market_move_attribution") flags.push({ code: "heuristic_market_attribution", severity: "medium" });
  if (event?.event_type === "fred_macro_observation") flags.push({ code: "macro_release_time_unknown", severity: "medium" });
  const requiresReview = flags.length > 0;
  return {
    version: EVENT_REVIEW_VERSION,
    requiresReview,
    suggestedStatus: requiresReview ? "needs_attention" : "accepted",
    flags
  };
}

function normalizeReviewDecision(input) {
  const value = input && typeof input === "object" ? input : {};
  const eventKey = boundedText(value.eventKey, 240);
  const reviewStatus = boundedText(value.reviewStatus, 32).toLowerCase();
  const reviewer = boundedText(value.reviewer, 80);
  const reviewNote = boundedText(value.reviewNote, 1000);
  if (!eventKey) throw new Error("eventKey is required");
  if (!REVIEW_STATUSES.has(reviewStatus)) throw new Error("reviewStatus must be accepted, rejected, or needs_attention");
  if (reviewer.length < 2) throw new Error("reviewer must contain at least 2 characters");
  return { eventKey, reviewStatus, reviewer, reviewNote };
}

async function getLatestReviewDecisions(config, eventIds) {
  const ids = Array.from(new Set((eventIds || []).filter(Boolean)));
  const result = new Map();
  for (let index = 0; index < ids.length; index += 100) {
    const page = await requestSupabase(
      config,
      "/rest/v1/event_review_decisions?select=id,event_id,review_status,reviewer,review_note,review_version,reviewed_at,created_at"
        + "&event_id=in.(" + ids.slice(index, index + 100).join(",") + ")"
        + "&order=reviewed_at.desc,created_at.desc&limit=1000"
    );
    (Array.isArray(page) ? page : []).forEach(function (decision) {
      if (!result.has(decision.event_id)) result.set(decision.event_id, decision);
    });
  }
  return result;
}

function buildEventReviewQueue(events, latestReviews, days) {
  const normalizedDays = normalizeHistoryDays(days);
  const reviews = latestReviews instanceof Map ? latestReviews : new Map();
  const queue = (events || []).map(function (event) {
    const classification = classifyEventForReview(event);
    const latestReview = reviews.get(event.id) || null;
    return {
      eventKey: event.event_key,
      marketDate: event.market_date,
      eventType: event.event_type,
      title: event.title,
      availableAt: event.available_at,
      confidence: event.confidence === null ? null : Number(event.confidence),
      sources: (event.sources || []).map(function (source) {
        return { provider: source.provider, title: source.title, url: source.canonical_url, relationType: source.relationType };
      }),
      classification,
      latestReview: latestReview ? {
        status: latestReview.review_status,
        version: latestReview.review_version,
        reviewedAt: latestReview.reviewed_at
      } : null,
      queueState: latestReview?.review_status === "accepted" ? "accepted"
        : latestReview?.review_status === "rejected" ? "rejected"
          : classification.requiresReview ? "needs_attention" : "unreviewed"
    };
  });
  return {
    version: EVENT_REVIEW_VERSION,
    days: normalizedDays,
    totalCount: queue.length,
    needsAttentionCount: queue.filter(function (item) { return item.queueState === "needs_attention"; }).length,
    unreviewedCount: queue.filter(function (item) { return !item.latestReview; }).length,
    items: queue
  };
}

function applyReviewDecisionsToEvents(events, latestReviews) {
  const reviews = latestReviews instanceof Map ? latestReviews : new Map();
  return (events || []).map(function (event) {
    const latestReview = reviews.get(event.id) || null;
    const classification = classifyEventForReview(event);
    return {
      ...event,
      review: {
        status: latestReview?.review_status || null,
        version: latestReview?.review_version || null,
        reviewedAt: latestReview?.reviewed_at || null,
        requiresAttention: classification.requiresReview,
        flags: classification.flags
      }
    };
  });
}

async function getEventReviewQueue(days) {
  const normalizedDays = normalizeHistoryDays(days);
  const config = getSupabaseConfig();
  const events = await getUnifiedMarketEvents(normalizedDays);
  const latestReviews = await getLatestReviewDecisions(config, events.map(function (event) { return event.id; }));
  return buildEventReviewQueue(events, latestReviews, normalizedDays);
}

async function recordEventReviewDecision(input) {
  const decision = normalizeReviewDecision(input);
  const config = getSupabaseConfig();
  const matches = await requestSupabase(
    config,
    "/rest/v1/events?select=id,event_key&event_key=eq." + encodeURIComponent(decision.eventKey) + "&limit=1"
  );
  const event = Array.isArray(matches) ? matches[0] : null;
  if (!event) throw new Error("Event was not found");
  const rows = await requestSupabase(config, "/rest/v1/event_review_decisions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: {
      event_id: event.id,
      review_status: decision.reviewStatus,
      reviewer: decision.reviewer,
      review_note: decision.reviewNote,
      review_version: EVENT_REVIEW_VERSION
    }
  });
  const saved = Array.isArray(rows) ? rows[0] : null;
  return {
    eventKey: event.event_key,
    status: saved?.review_status || decision.reviewStatus,
    reviewer: saved?.reviewer || decision.reviewer,
    reviewedAt: saved?.reviewed_at || null
  };
}

module.exports = {
  EVENT_REVIEW_VERSION,
  REVIEW_STATUSES,
  applyReviewDecisionsToEvents,
  buildEventReviewQueue,
  classifyEventForReview,
  getEventReviewQueue,
  getLatestReviewDecisions,
  normalizeReviewDecision,
  recordEventReviewDecision
};
