const crypto = require("crypto");

const RESEARCH_NARRATIVE_VERSION = "research-narrative-v1";
const MAX_TITLE_LENGTH = 100;
const MAX_RECAP_LENGTH = 900;
const MAX_CLAIM_LENGTH = 420;
const BANNED_NARRATIVE_PATTERNS = [
  /\b(buy|sell|long|short|overweight|underweight)\b/i,
  /买入|卖出|加仓|减仓|建仓|清仓|止盈|止损|目标价|价格目标|投资建议|荐股|必涨|必跌/,
  /预测概率|上涨概率|下跌概率|胜率预测|probability forecast/i
];

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce(function (result, key) {
      result[key] = canonicalJsonValue(value[key]);
      return result;
    }, {});
  }
  return value;
}

function fingerprint(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonicalJsonValue(value))).digest("hex");
}

function materialResearchPacket(packet) {
  const value = packet && typeof packet === "object" ? packet : {};
  const { generatedAt, ...facts } = value;
  return facts;
}

function researchPacketFingerprint(packet) {
  return fingerprint(materialResearchPacket(packet));
}

function safeText(value, maximum = 160) {
  return typeof value === "string" ? value.trim().slice(0, maximum) || null : null;
}

function sanitizeAuditMetadata(metadata = {}) {
  const source = metadata && typeof metadata === "object" ? metadata : {};
  const finite = function (value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  return {
    runId: safeText(source.runId, 100),
    generatedAt: safeText(source.generatedAt, 40) || new Date().toISOString(),
    latencyMs: finite(source.latencyMs),
    inputTokens: finite(source.inputTokens),
    outputTokens: finite(source.outputTokens),
    temperature: finite(source.temperature)
  };
}

function stringList(value, field, errors, options = {}) {
  if (!Array.isArray(value)) {
    errors.push(field + " must be an array");
    return [];
  }
  const items = value.map(function (item) { return typeof item === "string" ? item.trim() : ""; })
    .filter(Boolean);
  if (options.unique && new Set(items).size !== items.length) errors.push(field + " must not contain duplicates");
  if (options.maxLength && items.some(function (item) { return item.length > options.maxLength; })) {
    errors.push(field + " contains a value that is too long");
  }
  return items;
}

function containsBannedNarrative(value) {
  return BANNED_NARRATIVE_PATTERNS.some(function (pattern) { return pattern.test(value); });
}

function allowedEvidence(packet) {
  const eventByKey = new Map();
  const candidateDates = new Set();
  (Array.isArray(packet?.events) ? packet.events : []).forEach(function (event) {
    const eventKey = String(event?.eventKey || "");
    if (!eventKey || event?.review?.status === "rejected") return;
    eventByKey.set(eventKey, new Set((event.sources || []).map(function (source) { return source?.url; }).filter(Boolean)));
  });
  (packet?.historicalSimilarity?.matches || []).forEach(function (match) {
    if (match?.candidateMarketDate) candidateDates.add(String(match.candidateMarketDate));
  });
  return { eventByKey, candidateDates };
}

function validateCitation(citation, evidence, field, errors) {
  const value = citation && typeof citation === "object" ? citation : {};
  const eventKeys = stringList(value.eventKeys, field + ".eventKeys", errors, { unique: true, maxLength: 200 });
  const sourceUrls = stringList(value.sourceUrls, field + ".sourceUrls", errors, { unique: true, maxLength: 2000 });
  const candidateMarketDates = stringList(value.candidateMarketDates, field + ".candidateMarketDates", errors, { unique: true, maxLength: 10 });
  eventKeys.forEach(function (key) {
    if (!evidence.eventByKey.has(key)) errors.push(field + " cites an unknown event key: " + key);
  });
  sourceUrls.forEach(function (url) {
    const belongsToCitedEvent = eventKeys.some(function (key) { return evidence.eventByKey.get(key)?.has(url); });
    if (!belongsToCitedEvent) errors.push(field + " cites a source URL not attached to a cited event");
  });
  candidateMarketDates.forEach(function (date) {
    if (!evidence.candidateDates.has(date)) errors.push(field + " cites an unknown similar-day candidate: " + date);
  });
  if (!eventKeys.length && !candidateMarketDates.length) errors.push(field + " requires at least one event or historical candidate citation");
  if (eventKeys.length && !sourceUrls.length) errors.push(field + " must cite a source URL for every event-based claim");
  return { eventKeys, sourceUrls, candidateMarketDates };
}

function validateResearchNarrative(output, packet) {
  const errors = [];
  const value = output && typeof output === "object" && !Array.isArray(output) ? output : {};
  if (value.contractVersion !== RESEARCH_NARRATIVE_VERSION) errors.push("Unsupported narrative contract version");
  if (value.marketDate !== packet?.asOf?.marketDate) errors.push("Narrative marketDate must match the research packet");
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const recap = typeof value.recap === "string" ? value.recap.trim() : "";
  if (!title || title.length > MAX_TITLE_LENGTH) errors.push("Narrative title is missing or too long");
  if (!recap || recap.length > MAX_RECAP_LENGTH) errors.push("Narrative recap is missing or too long");
  if (containsBannedNarrative(title + "\n" + recap)) errors.push("Narrative contains prohibited recommendation or forecast language");

  if (!Array.isArray(value.claims)) errors.push("Narrative claims must be an array");
  const claims = (Array.isArray(value.claims) ? value.claims : []).map(function (claim, index) {
    const item = claim && typeof claim === "object" ? claim : {};
    const text = typeof item.text === "string" ? item.text.trim() : "";
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const field = "claims[" + index + "]";
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(id)) errors.push(field + ".id is invalid");
    if (!text || text.length > MAX_CLAIM_LENGTH) errors.push(field + ".text is missing or too long");
    if (containsBannedNarrative(text)) errors.push(field + ".text contains prohibited recommendation or forecast language");
    return { id, text, citations: validateCitation(item.citations, allowedEvidence(packet), field + ".citations", errors) };
  });
  if (!claims.length) errors.push("Narrative must include at least one cited claim");
  if (new Set(claims.map(function (claim) { return claim.id; }).filter(Boolean)).size !== claims.filter(function (claim) { return claim.id; }).length) {
    errors.push("Narrative claim ids must be unique");
  }

  const uncertainties = stringList(value.uncertainties, "uncertainties", errors, { unique: true, maxLength: 240 });
  if (!uncertainties.length) errors.push("Narrative must include at least one uncertainty");
  const normalized = {
    contractVersion: RESEARCH_NARRATIVE_VERSION,
    marketDate: value.marketDate || null,
    title,
    recap,
    claims,
    uncertainties
  };
  return { valid: errors.length === 0, errors, normalized };
}

function buildResearchNarrativeInstructions(packet) {
  const evidence = allowedEvidence(packet);
  return {
    contractVersion: RESEARCH_NARRATIVE_VERSION,
    inputPacketVersion: packet?.contractVersion || null,
    task: "Write an evidence-grounded market recap. Do not give investment advice or forecast probabilities.",
    requiredOutputShape: {
      contractVersion: RESEARCH_NARRATIVE_VERSION,
      marketDate: packet?.asOf?.marketDate || null,
      title: "string (max 100 chars)",
      recap: "string (max 900 chars)",
      claims: [{ id: "lowercase-id", text: "string (max 420 chars)", citations: { eventKeys: ["known event key"], sourceUrls: ["source URL for cited event"], candidateMarketDates: ["known historical candidate date"] } }],
      uncertainties: ["string"]
    },
    allowedEvidence: {
      eventKeys: Array.from(evidence.eventByKey.keys()),
      candidateMarketDates: Array.from(evidence.candidateDates)
    },
    prohibited: [
      "Investment instructions or target prices",
      "Forecast probabilities or claims of certainty",
      "Facts without a permitted citation",
      "Changing or inferring values absent from the input packet"
    ]
  };
}

function buildNarrativeAuditRecord(packet, output, validation, metadata = {}) {
  const safeMetadata = sanitizeAuditMetadata(metadata);
  return {
    market_date: packet?.asOf?.marketDate || null,
    packet_contract_version: packet?.contractVersion || null,
    packet_fingerprint: researchPacketFingerprint(packet),
    narrative_contract_version: output?.contractVersion || null,
    output_fingerprint: fingerprint(output),
    provider: safeText(metadata.provider),
    model: safeText(metadata.model),
    status: validation?.valid ? "accepted" : "rejected",
    narrative: output || {},
    validation_errors: validation?.errors || [],
    metadata: safeMetadata
  };
}

module.exports = {
  RESEARCH_NARRATIVE_VERSION,
  allowedEvidence,
  buildNarrativeAuditRecord,
  buildResearchNarrativeInstructions,
  canonicalJsonValue,
  fingerprint,
  materialResearchPacket,
  researchPacketFingerprint,
  sanitizeAuditMetadata,
  validateResearchNarrative
};
