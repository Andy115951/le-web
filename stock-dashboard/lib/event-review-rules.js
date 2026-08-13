const EVENT_REVIEW_VERSION = "event-review-rules-v1";

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
  return { version: EVENT_REVIEW_VERSION, requiresReview, suggestedStatus: requiresReview ? "needs_attention" : "accepted", flags };
}

module.exports = { EVENT_REVIEW_VERSION, classifyEventForReview };
