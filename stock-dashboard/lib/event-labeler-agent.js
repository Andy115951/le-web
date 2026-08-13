const crypto = require("crypto");
const { classifyEventForReview } = require("./event-review");
const { getSupabaseConfig, requestSupabase } = require("./supabase-server");
const { getUnifiedMarketEventsRange } = require("./unified-market-events");

const EVENT_LABELER_AGENT_VERSION = "event-labeler-agent-v1";

function normalizeMarketDate(value) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date + "T12:00:00.000Z").toISOString().slice(0, 10) !== date) {
    throw new Error("Invalid event label market date");
  }
  return date;
}

function relationCounts(event) {
  return (Array.isArray(event?.sources) ? event.sources : []).reduce(function (counts, source) {
    if (source?.relationType === "primary") counts.primary += 1;
    if (source?.relationType === "evidence") counts.evidence += 1;
    if (source?.relationType === "context") counts.context += 1;
    return counts;
  }, { primary: 0, evidence: 0, context: 0 });
}

function buildLabelInput(event) {
  const counts = relationCounts(event);
  return {
    eventId: String(event?.id || "").trim(),
    eventKey: String(event?.event_key || "").trim(),
    marketDate: String(event?.market_date || "").trim(),
    eventType: String(event?.event_type || "").trim(),
    confidence: Number.isFinite(Number(event?.confidence)) ? Number(Number(event.confidence).toFixed(3)) : null,
    availableAt: String(event?.available_at || event?.availableAt || "").trim() || null,
    primarySourceCount: counts.primary,
    evidenceSourceCount: counts.evidence,
    contextSourceCount: counts.context
  };
}

function inputFingerprint(input) {
  return crypto.createHash("sha256").update(JSON.stringify({ version: EVENT_LABELER_AGENT_VERSION, ...input })).digest("hex");
}

function isUuid(value) {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(String(value || ""));
}

function sanitizeFlags(flags) {
  return (Array.isArray(flags) ? flags : []).flatMap(function (flag) {
    const code = String(flag?.code || "").trim();
    const severity = String(flag?.severity || "medium").trim();
    return /^[a-z0-9_]{3,80}$/.test(code) && ["low", "medium", "high"].includes(severity) ? [{ code, severity }] : [];
  });
}

function buildEventRuleLabelRecords(events, now = new Date()) {
  const computedAt = now.toISOString();
  return (Array.isArray(events) ? events : []).flatMap(function (event) {
    const input = buildLabelInput(event);
    if (!isUuid(input.eventId)) return [];
    try { input.marketDate = normalizeMarketDate(input.marketDate); } catch { return []; }
    const classification = classifyEventForReview(event);
    const flags = sanitizeFlags(classification.flags);
    return [{
      event_id: input.eventId,
      label_version: EVENT_LABELER_AGENT_VERSION,
      input_fingerprint: inputFingerprint(input),
      suggested_status: classification.requiresReview ? "needs_attention" : "accepted",
      requires_review: Boolean(classification.requiresReview),
      flags,
      computed_at: computedAt
    }];
  });
}

async function persistEventRuleLabels(config, records, requestImpl = requestSupabase) {
  if (!Array.isArray(records) || !records.length) return { written: 0 };
  const saved = await requestImpl(config, "/rest/v1/event_rule_labels?on_conflict=event_id,label_version,input_fingerprint", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: records
  });
  return { written: Array.isArray(saved) ? saved.length : 0 };
}

async function runEventLabelerAgent(options = {}) {
  const marketDate = normalizeMarketDate(options.marketDate);
  const events = await (options.getEvents || getUnifiedMarketEventsRange)(marketDate, marketDate, { includeRelations: true });
  const records = buildEventRuleLabelRecords(events, options.now || new Date());
  if (!records.length) return { status: "skipped", labelVersion: EVENT_LABELER_AGENT_VERSION, processedEvents: 0, labelsWritten: 0, requiresReviewCount: 0 };
  const saved = await (options.persist || persistEventRuleLabels)(options.config || getSupabaseConfig(), records, options.requestSupabase || requestSupabase);
  return {
    status: "succeeded",
    labelVersion: EVENT_LABELER_AGENT_VERSION,
    processedEvents: records.length,
    labelsWritten: Number(saved?.written || 0),
    requiresReviewCount: records.filter(function (record) { return record.requires_review; }).length
  };
}

module.exports = {
  EVENT_LABELER_AGENT_VERSION,
  buildEventRuleLabelRecords,
  buildLabelInput,
  inputFingerprint,
  persistEventRuleLabels,
  relationCounts,
  runEventLabelerAgent
};
