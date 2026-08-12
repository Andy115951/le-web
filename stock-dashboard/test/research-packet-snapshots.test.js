const assert = require("node:assert/strict");
const test = require("node:test");
const {
  RESEARCH_PACKET_SNAPSHOT_VERSION,
  buildResearchPacketSnapshot,
  buildSourceSummary,
  getResearchPacketSnapshots,
  persistResearchPacketSnapshot,
  researchPacketFingerprint
} = require("../lib/research-packet-snapshots");

function packet(generatedAt) {
  return {
    contractVersion: "daily-research-packet-v1",
    generatedAt,
    asOf: { marketDate: "2026-08-11" },
    events: [{
      eventKey: "sec-filing:sample:NVDA",
      eventType: "sec_filing",
      review: { status: "accepted", requiresAttention: false },
      sources: [{ provider: "SEC EDGAR", sourceKind: "filing", url: "https://www.sec.gov/example" }]
    }, {
      eventKey: "market-move:2026-08-11:QQQ:v1",
      eventType: "market_move_attribution",
      review: { status: null, requiresAttention: true },
      sources: [{ provider: "Yahoo Finance", sourceKind: "market_data", url: "https://finance.yahoo.com/example" }]
    }],
    historicalSimilarity: { candidateCount: 5 },
    ndxSnapshot: { effectiveDate: "2026-05-01" }
  };
}

test("research packet snapshot fingerprints facts rather than generation time", function () {
  const first = packet("2026-08-11T20:01:00.000Z");
  const second = packet("2026-08-11T22:01:00.000Z");
  assert.equal(researchPacketFingerprint(first), researchPacketFingerprint(second));
  const record = buildResearchPacketSnapshot(first, "2026-08-11T22:02:00.000Z");
  assert.equal(record.market_date, "2026-08-11");
  assert.equal(record.packet_fingerprint.length, 64);
  assert.equal(record.captured_at, "2026-08-11T22:02:00.000Z");
  assert.equal(record.source_summary.snapshotVersion, RESEARCH_PACKET_SNAPSHOT_VERSION);
  assert.deepEqual(record.source_summary.eventTypes, { sec_filing: 1, market_move_attribution: 1 });
  assert.deepEqual(record.source_summary.reviewStatuses, { accepted: 1, needs_attention: 1 });
});

test("research packet snapshot storage ignores duplicate packet fingerprints", async function () {
  const calls = [];
  const result = await persistResearchPacketSnapshot({}, packet("2026-08-11T20:01:00.000Z"), "2026-08-11T22:02:00.000Z", async function (_config, path, options) {
    calls.push({ path, options });
    return [];
  });
  assert.equal(result.created, false);
  assert.match(calls[0].path, /on_conflict=market_date,packet_fingerprint/);
  assert.equal(calls[0].options.headers.Prefer, "resolution=ignore-duplicates,return=representation");
});

test("snapshot listing omits full packet by default and validates requested dates", async function () {
  const calls = [];
  const client = async function (_config, path) {
    calls.push(path);
    return [{ id: "snapshot-1", market_date: "2026-08-11" }];
  };
  const summary = await getResearchPacketSnapshots({ limit: 999 }, {}, client);
  assert.equal(summary.count, 1);
  assert.equal(summary.includePacket, false);
  assert.equal(calls[0].includes("packet,"), false);
  const replay = await getResearchPacketSnapshots({ date: "2026-08-11", includePacket: true }, {}, client);
  assert.equal(replay.date, "2026-08-11");
  assert.equal(replay.includePacket, true);
  assert.equal(calls[1].includes("packet,"), true);
  await assert.rejects(function () { return getResearchPacketSnapshots({ date: "not-a-date" }, {}, client); }, /Invalid calendar date/);
});

test("source summary only records aggregate provenance metadata", function () {
  const summary = buildSourceSummary(packet("2026-08-11T20:01:00.000Z"));
  assert.equal(summary.eventCount, 2);
  assert.deepEqual(summary.sourceKinds, { filing: 1, market_data: 1 });
  assert.deepEqual(summary.providers, { "SEC EDGAR": 1, "Yahoo Finance": 1 });
  assert.equal(JSON.stringify(summary).includes("https://"), false);
});
