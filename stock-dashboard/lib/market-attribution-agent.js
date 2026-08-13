const crypto = require("crypto");
const { getSupabaseConfig, requestSupabase } = require("./supabase-server");
const { getUnifiedMarketEventsRange } = require("./unified-market-events");

const MARKET_ATTRIBUTION_AGENT_VERSION = "market-attribution-agent-v1";
const ATTRIBUTION_CLASSIFICATIONS = new Set(["market", "company", "mixed", "insufficient_evidence"]);

function normalizeMarketDate(value) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid attribution market date");
  if (new Date(date + "T12:00:00.000Z").toISOString().slice(0, 10) !== date) {
    throw new Error("Invalid attribution market date");
  }
  return date;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(4)) : null;
}

function boundedConfidence(value, fallback) {
  const number = finiteNumber(value);
  if (number === null) return fallback;
  return Math.max(0, Math.min(1, Number(number.toFixed(3))));
}

function sourceCounts(event) {
  return (Array.isArray(event?.sources) ? event.sources : []).reduce(function (counts, source) {
    if (source?.relationType === "primary") counts.primary += 1;
    if (source?.relationType === "evidence") counts.evidence += 1;
    if (source?.relationType === "context") counts.counterEvidence += 1;
    return counts;
  }, { primary: 0, evidence: 0, counterEvidence: 0 });
}

function sameDirection(left, right) {
  return (left > 0 && right > 0) || (left < 0 && right < 0);
}

function normalizeDriverType(value) {
  const type = String(value || "").trim().toLowerCase();
  return ["market", "company", "mixed"].includes(type) ? type : "unclear";
}

function buildAttributionInput(event) {
  const attributes = event?.attributes && typeof event.attributes === "object" ? event.attributes : {};
  const counts = sourceCounts(event);
  return {
    eventId: String(event?.id || "").trim(),
    eventKey: String(event?.event_key || "").trim(),
    marketDate: String(event?.market_date || "").trim(),
    changePercent: finiteNumber(attributes.changePercent),
    benchmarkChangePercent: finiteNumber(attributes.benchmarkChangePercent),
    upstreamDriverType: normalizeDriverType(attributes.driverType),
    upstreamConfidence: boundedConfidence(event?.confidence, 0.35),
    primarySourceCount: counts.primary,
    evidenceSourceCount: counts.evidence,
    counterEvidenceCount: counts.counterEvidence
  };
}

function attributionInputFingerprint(input) {
  const canonical = JSON.stringify({
    version: MARKET_ATTRIBUTION_AGENT_VERSION,
    eventKey: input.eventKey,
    marketDate: input.marketDate,
    changePercent: input.changePercent,
    benchmarkChangePercent: input.benchmarkChangePercent,
    upstreamDriverType: input.upstreamDriverType,
    upstreamConfidence: input.upstreamConfidence,
    primarySourceCount: input.primarySourceCount,
    evidenceSourceCount: input.evidenceSourceCount,
    counterEvidenceCount: input.counterEvidenceCount
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

function classifyAttribution(input) {
  const relativeMove = input.changePercent !== null && input.benchmarkChangePercent !== null
    ? Number((input.changePercent - input.benchmarkChangePercent).toFixed(2))
    : null;
  const aligned = input.changePercent !== null && input.benchmarkChangePercent !== null
    && sameDirection(input.changePercent, input.benchmarkChangePercent);
  const hasMarketEvidence = input.primarySourceCount > 0 && aligned;
  const hasCompanyEvidence = input.evidenceSourceCount > 0
    && (relativeMove === null || Math.abs(relativeMove) >= 1);

  if (input.upstreamDriverType === "mixed" && hasMarketEvidence && hasCompanyEvidence) {
    return { classification: "mixed", confidence: Math.min(input.upstreamConfidence, 0.65), hypothesisCode: "mixed_market_and_company_evidence" };
  }
  if (input.upstreamDriverType === "company" && hasCompanyEvidence) {
    return { classification: "company", confidence: Math.min(input.upstreamConfidence, 0.65), hypothesisCode: "company_relative_move_with_evidence" };
  }
  if (input.upstreamDriverType === "market" && hasMarketEvidence) {
    return { classification: "market", confidence: Math.min(input.upstreamConfidence, 0.55), hypothesisCode: "market_aligned_with_benchmark" };
  }
  return { classification: "insufficient_evidence", confidence: 0.35, hypothesisCode: "insufficient_structured_evidence" };
}

function isValidEventId(value) {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(String(value || ""));
}

function buildMarketEventAttributionRecords(events, now = new Date()) {
  const computedAt = now.toISOString();
  return (Array.isArray(events) ? events : []).flatMap(function (event) {
    const input = buildAttributionInput(event);
    if (!isValidEventId(input.eventId)) return [];
    try {
      input.marketDate = normalizeMarketDate(input.marketDate);
    } catch {
      return [];
    }
    const result = classifyAttribution(input);
    return [{
      event_id: input.eventId,
      market_date: input.marketDate,
      attribution_version: MARKET_ATTRIBUTION_AGENT_VERSION,
      input_fingerprint: attributionInputFingerprint(input),
      classification: result.classification,
      confidence: result.confidence,
      hypothesis_code: result.hypothesisCode,
      primary_source_count: input.primarySourceCount,
      evidence_source_count: input.evidenceSourceCount,
      counter_evidence_count: input.counterEvidenceCount,
      computed_at: computedAt
    }];
  });
}

function buildAttributionSummary(records, written) {
  const rows = Array.isArray(records) ? records : [];
  return {
    deterministicAttributions: rows.length,
    heuristicAttributionCount: 0,
    primarySourcesLinked: rows.reduce(function (sum, row) { return sum + row.primary_source_count; }, 0),
    evidenceSourcesLinked: rows.reduce(function (sum, row) { return sum + row.evidence_source_count; }, 0),
    attributionsWritten: Number.isFinite(Number(written)) ? Number(written) : 0
  };
}

async function persistMarketEventAttributions(config, records, requestImpl = requestSupabase) {
  if (!Array.isArray(records) || !records.length) return { written: 0 };
  const saved = await requestImpl(config, "/rest/v1/market_event_attributions?on_conflict=event_id,attribution_version,input_fingerprint", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: records
  });
  return { written: Array.isArray(saved) ? saved.length : 0 };
}

async function runMarketAttributionAgent(options = {}) {
  const marketDate = normalizeMarketDate(options.marketDate);
  const getEvents = options.getEvents || getUnifiedMarketEventsRange;
  const events = await getEvents(marketDate, marketDate, { includeRelations: true });
  const records = buildMarketEventAttributionRecords(events, options.now || new Date());
  if (!records.length) return { status: "skipped", attributionVersion: MARKET_ATTRIBUTION_AGENT_VERSION, processedEvents: 0, ...buildAttributionSummary([], 0) };
  const saved = await (options.persist || persistMarketEventAttributions)(options.config || getSupabaseConfig(), records, options.requestSupabase || requestSupabase);
  return {
    status: "succeeded",
    attributionVersion: MARKET_ATTRIBUTION_AGENT_VERSION,
    processedEvents: records.length,
    ...buildAttributionSummary(records, saved?.written)
  };
}

function normalizeAttributionLimit(value) {
  const limit = Number(value) || 100;
  return Math.max(1, Math.min(200, Math.round(limit)));
}

async function getMarketEventAttributions(options = {}, config = getSupabaseConfig(), requestImpl = requestSupabase) {
  const marketDate = normalizeMarketDate(options.marketDate);
  const limit = normalizeAttributionLimit(options.limit);
  const columns = "event_id,market_date,attribution_version,classification,confidence,hypothesis_code,primary_source_count,evidence_source_count,counter_evidence_count,computed_at";
  const rows = await requestImpl(config, "/rest/v1/market_event_attributions?select=" + columns
    + "&market_date=eq." + marketDate + "&order=computed_at.desc&limit=" + Math.max(limit * 4, 100));
  const seenEventIds = new Set();
  const attributions = (Array.isArray(rows) ? rows : []).flatMap(function (row) {
    if (seenEventIds.has(row.event_id) || !ATTRIBUTION_CLASSIFICATIONS.has(row.classification)) return [];
    seenEventIds.add(row.event_id);
    return [{
      marketDate: row.market_date,
      attributionVersion: row.attribution_version,
      classification: row.classification,
      confidence: boundedConfidence(row.confidence, 0),
      hypothesisCode: row.hypothesis_code,
      primarySourceCount: Number(row.primary_source_count || 0),
      evidenceSourceCount: Number(row.evidence_source_count || 0),
      counterEvidenceCount: Number(row.counter_evidence_count || 0),
      computedAt: row.computed_at
    }];
  }).slice(0, limit);
  return { version: MARKET_ATTRIBUTION_AGENT_VERSION, marketDate, count: attributions.length, attributions };
}

module.exports = {
  ATTRIBUTION_CLASSIFICATIONS,
  MARKET_ATTRIBUTION_AGENT_VERSION,
  attributionInputFingerprint,
  buildAttributionInput,
  buildAttributionSummary,
  buildMarketEventAttributionRecords,
  classifyAttribution,
  getMarketEventAttributions,
  normalizeAttributionLimit,
  normalizeMarketDate,
  persistMarketEventAttributions,
  runMarketAttributionAgent,
  sourceCounts
};
