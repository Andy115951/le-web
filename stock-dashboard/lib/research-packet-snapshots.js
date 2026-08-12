const { normalizeDate } = require("./market-calendar");
const { materialResearchPacket, researchPacketFingerprint } = require("./research-narrative-contract");
const { getSupabaseConfig, requestSupabase } = require("./supabase-server");

const RESEARCH_PACKET_SNAPSHOT_VERSION = "research-packet-snapshot-v1";

function normalizeSnapshotLimit(value) {
  const limit = Number(value) || 10;
  return Math.max(1, Math.min(30, Math.round(limit)));
}

function materialPacket(packet) {
  return materialResearchPacket(packet);
}

function incrementCount(counts, key) {
  const normalized = String(key || "unknown").trim() || "unknown";
  counts[normalized] = (counts[normalized] || 0) + 1;
}

function buildSourceSummary(packet) {
  const eventTypes = {};
  const reviewStatuses = {};
  const sourceKinds = {};
  const providers = {};
  const events = Array.isArray(packet?.events) ? packet.events : [];
  events.forEach(function (event) {
    incrementCount(eventTypes, event?.eventType);
    incrementCount(reviewStatuses, event?.review?.status || (event?.review?.requiresAttention ? "needs_attention" : "unreviewed"));
    (Array.isArray(event?.sources) ? event.sources : []).forEach(function (source) {
      incrementCount(sourceKinds, source?.sourceKind);
      incrementCount(providers, source?.provider);
    });
  });
  return {
    snapshotVersion: RESEARCH_PACKET_SNAPSHOT_VERSION,
    eventCount: events.length,
    eventTypes,
    reviewStatuses,
    sourceKinds,
    providers,
    similarDayCandidateCount: Number(packet?.historicalSimilarity?.candidateCount) || 0,
    ndxSnapshotEffectiveDate: packet?.ndxSnapshot?.effectiveDate || null
  };
}

function buildResearchPacketSnapshot(packet, capturedAt = new Date().toISOString()) {
  const marketDate = normalizeDate(packet?.asOf?.marketDate);
  const captured = new Date(capturedAt).toISOString();
  if (!packet?.contractVersion) throw new Error("Research packet contractVersion is required");
  return {
    market_date: marketDate,
    packet_contract_version: String(packet.contractVersion),
    packet_fingerprint: researchPacketFingerprint(packet),
    packet,
    source_summary: buildSourceSummary(packet),
    captured_at: captured
  };
}

async function persistResearchPacketSnapshot(config, packet, capturedAt, requestImpl = requestSupabase) {
  const record = buildResearchPacketSnapshot(packet, capturedAt);
  const rows = await requestImpl(config, "/rest/v1/research_packet_snapshots?on_conflict=market_date,packet_fingerprint", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: record
  });
  return {
    created: Array.isArray(rows) && rows.length > 0,
    marketDate: record.market_date,
    packetFingerprint: record.packet_fingerprint,
    sourceSummary: record.source_summary
  };
}

async function getResearchPacketSnapshots(options = {}, config = getSupabaseConfig(), requestImpl = requestSupabase) {
  const limit = normalizeSnapshotLimit(options.limit);
  const date = options.date ? normalizeDate(options.date) : null;
  const includePacket = options.includePacket === true || options.includePacket === "true" || options.includePacket === "1";
  const columns = includePacket
    ? "id,market_date,packet_contract_version,packet_fingerprint,packet,source_summary,captured_at,created_at"
    : "id,market_date,packet_contract_version,packet_fingerprint,source_summary,captured_at,created_at";
  const rows = await requestImpl(
    config,
    "/rest/v1/research_packet_snapshots?select=" + columns
      + (date ? "&market_date=eq." + date : "")
      + "&order=captured_at.desc,created_at.desc&limit=" + limit
  );
  return {
    version: RESEARCH_PACKET_SNAPSHOT_VERSION,
    count: Array.isArray(rows) ? rows.length : 0,
    date,
    includePacket,
    snapshots: Array.isArray(rows) ? rows : []
  };
}

async function rehashResearchPacketSnapshots(config = getSupabaseConfig(), requestImpl = requestSupabase) {
  const rows = await requestImpl(config, "/rest/v1/research_packet_snapshots?select=id,market_date,packet_fingerprint,packet&order=market_date.desc,captured_at.desc&limit=1000");
  const snapshots = Array.isArray(rows) ? rows : [];
  const planned = snapshots.map(function (snapshot) {
    return {
      ...snapshot,
      expectedFingerprint: researchPacketFingerprint(snapshot.packet)
    };
  });
  const destinations = new Map();
  planned.forEach(function (snapshot) {
    const key = snapshot.market_date + ":" + snapshot.expectedFingerprint;
    if (destinations.has(key) && destinations.get(key) !== snapshot.id) {
      throw new Error("Cannot rehash duplicate snapshots without an explicit merge: " + snapshot.market_date);
    }
    destinations.set(key, snapshot.id);
  });
  const updates = planned.filter(function (snapshot) { return snapshot.packet_fingerprint !== snapshot.expectedFingerprint; });
  for (const snapshot of updates) {
    await requestImpl(config, "/rest/v1/research_packet_snapshots?id=eq." + encodeURIComponent(snapshot.id), {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: { packet_fingerprint: snapshot.expectedFingerprint }
    });
  }
  return { scanned: snapshots.length, updated: updates.length };
}

module.exports = {
  RESEARCH_PACKET_SNAPSHOT_VERSION,
  buildResearchPacketSnapshot,
  buildSourceSummary,
  getResearchPacketSnapshots,
  materialPacket,
  normalizeSnapshotLimit,
  persistResearchPacketSnapshot,
  rehashResearchPacketSnapshots,
  researchPacketFingerprint
};
