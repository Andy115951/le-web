const { getSupabaseConfig, requestSupabase } = require("./supabase-server");
const { buildNarrativeAuditRecord, validateResearchNarrative } = require("./research-narrative-contract");
const { normalizeDate } = require("./market-calendar");

function normalizeNarrativeLimit(value) {
  const limit = Number(value) || 10;
  return Math.max(1, Math.min(30, Math.round(limit)));
}

async function persistResearchNarrativeAudit(packet, output, metadata, config = getSupabaseConfig(), requestImpl = requestSupabase) {
  const validation = validateResearchNarrative(output, packet);
  const record = buildNarrativeAuditRecord(packet, output, validation, metadata);
  const rows = await requestImpl(config, "/rest/v1/research_narrative_audits", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: record
  });
  return { validation, audit: Array.isArray(rows) ? rows[0] || null : null };
}

async function getAcceptedResearchNarrative(options = {}, config = getSupabaseConfig(), requestImpl = requestSupabase) {
  const packetFingerprint = String(options.packetFingerprint || "").trim();
  const provider = String(options.provider || "").trim();
  const model = String(options.model || "").trim();
  if (!/^[a-f0-9]{64}$/.test(packetFingerprint) || !provider || !model) return null;
  const rows = await requestImpl(
    config,
    "/rest/v1/research_narrative_audits?select=id,market_date,packet_fingerprint,provider,model,narrative,metadata,created_at"
      + "&status=eq.accepted"
      + "&packet_fingerprint=eq." + encodeURIComponent(packetFingerprint)
      + "&provider=eq." + encodeURIComponent(provider)
      + "&model=eq." + encodeURIComponent(model)
      + "&order=created_at.desc&limit=1"
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getRecentProviderNarrativeAttempts(options = {}, config = getSupabaseConfig(), requestImpl = requestSupabase) {
  const provider = String(options.provider || "").trim();
  const limit = Math.max(1, Math.min(60, Math.round(Number(options.limit) || 20)));
  if (!provider) return [];
  const rows = await requestImpl(
    config,
    "/rest/v1/research_narrative_audits?select=id,created_at,status,packet_fingerprint,model"
      + "&provider=eq." + encodeURIComponent(provider)
      + "&order=created_at.desc&limit=" + limit
  );
  return Array.isArray(rows) ? rows : [];
}

async function getPublishedResearchNarratives(options = {}, config = getSupabaseConfig(), requestImpl = requestSupabase) {
  const limit = normalizeNarrativeLimit(options.limit);
  const date = options.date ? normalizeDate(options.date) : null;
  const rows = await requestImpl(
    config,
    "/rest/v1/research_narrative_audits?select=id,market_date,packet_fingerprint,provider,model,narrative,metadata,created_at"
      + "&status=eq.accepted"
      + (date ? "&market_date=eq." + date : "")
      + "&order=market_date.desc,created_at.desc&limit=" + limit
  );
  return {
    count: Array.isArray(rows) ? rows.length : 0,
    date: date || null,
    narratives: Array.isArray(rows) ? rows : []
  };
}

module.exports = {
  getAcceptedResearchNarrative,
  getPublishedResearchNarratives,
  getRecentProviderNarrativeAttempts,
  normalizeNarrativeLimit,
  persistResearchNarrativeAudit
};
