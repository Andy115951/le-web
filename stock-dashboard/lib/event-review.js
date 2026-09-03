const { getSupabaseConfig, requestSupabase } = require("./supabase-server");
const { getUnifiedMarketEvents, normalizeHistoryDays } = require("./unified-market-events");
const { EVENT_REVIEW_VERSION, classifyEventForReview } = require("./event-review-rules");
const { getLatestEventRuleLabels } = require("./event-labeler-agent");

const REVIEW_STATUSES = new Set(["accepted", "rejected", "needs_attention"]);

function boundedText(value, maximum) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function labelClassification(label) {
  if (!label || typeof label !== "object") return null;
  const flags = Array.isArray(label.flags) ? label.flags : [];
  return {
    version: String(label.label_version || EVENT_REVIEW_VERSION),
    requiresReview: Boolean(label.requires_review),
    suggestedStatus: label.suggested_status === "needs_attention" ? "needs_attention" : "accepted",
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

function buildEventReviewQueue(events, latestReviews, days, latestLabels) {
  const normalizedDays = normalizeHistoryDays(days);
  const reviews = latestReviews instanceof Map ? latestReviews : new Map();
  const labels = latestLabels instanceof Map ? latestLabels : new Map();
  const queue = (events || []).map(function (event) {
    const classification = labelClassification(labels.get(event.id)) || classifyEventForReview(event);
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
  const needsAttentionItems = queue.filter(function (item) { return item.queueState === "needs_attention"; });
  const priorityEventKeys = buildEventReviewFocus(needsAttentionItems, 20).items.map(function (item) { return item.eventKey; });
  return {
    version: EVENT_REVIEW_VERSION,
    days: normalizedDays,
    totalCount: queue.length,
    needsAttentionCount: needsAttentionItems.length,
    unreviewedCount: queue.filter(function (item) { return !item.latestReview; }).length,
    triage: buildEventReviewTriage(needsAttentionItems),
    priorityEventKeys,
    items: queue
  };
}

function buildEventReviewTriage(items) {
  const byFlag = new Map();
  const byEventType = new Map();
  (items || []).forEach(function (item) {
    const eventType = boundedText(item?.eventType, 80) || "unknown";
    byEventType.set(eventType, (byEventType.get(eventType) || 0) + 1);
    (item?.classification?.flags || []).forEach(function (flag) {
      const code = boundedText(flag?.code, 80) || "review_flag";
      const severity = boundedText(flag?.severity, 20) || "medium";
      const key = severity + ":" + code;
      const current = byFlag.get(key) || { code, severity, count: 0 };
      current.count += 1;
      byFlag.set(key, current);
    });
  });
  const order = function (left, right) {
    return right.count - left.count || String(left.code || left.eventType).localeCompare(String(right.code || right.eventType));
  };
  return {
    attentionCount: Array.isArray(items) ? items.length : 0,
    byFlag: Array.from(byFlag.values()).sort(order).slice(0, 6),
    byEventType: Array.from(byEventType.entries()).map(function ([eventType, count]) {
      return { eventType, count };
    }).sort(order).slice(0, 6)
  };
}

function reviewPriorityScore(item) {
  const severityWeight = { high: 100, medium: 10, low: 1 };
  return (item?.classification?.flags || []).reduce(function (score, flag) {
    return score + (severityWeight[boundedText(flag?.severity, 20).toLowerCase()] || 0);
  }, 0);
}

function buildEventReviewFocus(items, limit) {
  const requestedLimit = Number(limit);
  const maximumCount = Number.isInteger(requestedLimit) ? Math.min(20, Math.max(1, requestedLimit)) : 12;
  const candidates = (items || []).filter(function (item) { return item?.queueState === "needs_attention"; });
  const focused = candidates.slice().sort(function (left, right) {
    return reviewPriorityScore(right) - reviewPriorityScore(left)
      || String(right?.marketDate || "").localeCompare(String(left?.marketDate || ""))
      || String(left?.eventKey || "").localeCompare(String(right?.eventKey || ""));
  }).slice(0, maximumCount).map(function (item) {
    const primary = (item.sources || []).find(function (source) { return source?.relationType === "primary"; }) || null;
    return {
      eventKey: item.eventKey,
      marketDate: item.marketDate,
      eventType: item.eventType,
      title: item.title,
      confidence: item.confidence,
      flags: (item.classification?.flags || []).map(function (flag) {
        return { code: boundedText(flag?.code, 80) || "review_flag", severity: boundedText(flag?.severity, 20) || "medium" };
      }),
      primarySource: primary ? {
        provider: boundedText(primary.provider, 80),
        title: boundedText(primary.title, 240),
        url: boundedText(primary.url, 2000)
      } : null
    };
  });
  return {
    totalCandidates: candidates.length,
    maximumCount,
    items: focused
  };
}

function applyReviewDecisionsToEvents(events, latestReviews, latestLabels) {
  const reviews = latestReviews instanceof Map ? latestReviews : new Map();
  const labels = latestLabels instanceof Map ? latestLabels : new Map();
  return (events || []).map(function (event) {
    const latestReview = reviews.get(event.id) || null;
    const classification = labelClassification(labels.get(event.id)) || classifyEventForReview(event);
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
  const eventIds = events.map(function (event) { return event.id; });
  const [latestReviews, latestLabels] = await Promise.all([getLatestReviewDecisions(config, eventIds), getLatestEventRuleLabels(config, eventIds)]);
  return buildEventReviewQueue(events, latestReviews, normalizedDays, latestLabels);
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
  buildEventReviewFocus,
  buildEventReviewQueue,
  buildEventReviewTriage,
  classifyEventForReview,
  getEventReviewQueue,
  getLatestReviewDecisions,
  labelClassification,
  normalizeReviewDecision,
  recordEventReviewDecision
};
