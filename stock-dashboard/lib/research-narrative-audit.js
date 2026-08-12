const { getSupabaseConfig, requestSupabase } = require("./supabase-server");
const { buildNarrativeAuditRecord, validateResearchNarrative } = require("./research-narrative-contract");

async function persistResearchNarrativeAudit(packet, output, metadata) {
  const validation = validateResearchNarrative(output, packet);
  const record = buildNarrativeAuditRecord(packet, output, validation, metadata);
  const config = getSupabaseConfig();
  const rows = await requestSupabase(config, "/rest/v1/research_narrative_audits", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: record
  });
  return { validation, audit: Array.isArray(rows) ? rows[0] || null : null };
}

module.exports = { persistResearchNarrativeAudit };
