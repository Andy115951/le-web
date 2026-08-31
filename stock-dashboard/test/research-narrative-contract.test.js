const assert = require("node:assert/strict");
const test = require("node:test");
const {
  RESEARCH_NARRATIVE_VERSION,
  buildNarrativeAuditRecord,
  buildResearchNarrativeInstructions,
  researchPacketFingerprint,
  sanitizeAuditMetadata,
  validateResearchNarrative
} = require("../lib/research-narrative-contract");

const packet = {
  contractVersion: "daily-research-packet-v1",
  asOf: { marketDate: "2026-08-11" },
  events: [{
    eventKey: "sec-filing:sample:NVDA",
    sources: [{ url: "https://www.sec.gov/Archives/sample.htm" }]
  }],
  historicalSimilarity: {
    matches: [{ candidateMarketDate: "2025-03-27" }]
  }
};

function validNarrative() {
  return {
    contractVersion: RESEARCH_NARRATIVE_VERSION,
    marketDate: "2026-08-11",
    title: "市场事实复盘",
    recap: "已披露的文件和历史相似样本提供背景，但不构成交易结论。",
    claims: [{
      id: "filing-context",
      text: "该日存在一条可复核的 SEC 文件事件。",
      citations: {
        eventKeys: ["sec-filing:sample:NVDA"],
        sourceUrls: ["https://www.sec.gov/Archives/sample.htm"],
        candidateMarketDates: []
      }
    }, {
      id: "history-context",
      text: "一个更早的相似状态样本可用于历史对照。",
      citations: {
        eventKeys: [],
        sourceUrls: [],
        candidateMarketDates: ["2025-03-27"]
      }
    }],
    uncertainties: ["当前事件覆盖范围仍不完整。"]
  };
}

test("research narrative contract accepts only cited evidence from the packet", function () {
  const validation = validateResearchNarrative(validNarrative(), packet);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
  const instructions = buildResearchNarrativeInstructions(packet);
  assert.deepEqual(instructions.allowedEvidence.eventKeys, ["sec-filing:sample:NVDA"]);
  assert.deepEqual(instructions.allowedEvidence.candidateMarketDates, ["2025-03-27"]);
});

test("research narrative contract rejects uncited sources and investment instructions", function () {
  const invalid = validNarrative();
  invalid.claims[0].citations.sourceUrls = ["https://example.com/not-in-packet"];
  invalid.recap = "建议买入，因为上涨概率很高。";
  const validation = validateResearchNarrative(invalid, packet);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(function (error) { return /not attached/.test(error); }));
  assert.ok(validation.errors.some(function (error) { return /prohibited/.test(error); }));
});

test("research narrative contract accepts baseline citations for packet market/NDX facts", function () {
  const baselinePacket = {
    ...packet,
    marketState: { symbol: "QQQ", changePercent: -0.34 },
    ndxSnapshot: { topMembers: [{ symbol: "NVDA", weightPercent: 8.42 }] }
  };
  const instructions = buildResearchNarrativeInstructions(baselinePacket);
  assert.deepEqual(instructions.allowedEvidence.baselineKeys, ["market:QQQ", "ndx-weights"]);

  const narrative = validNarrative();
  narrative.claims.push({
    id: "qqq-close",
    text: "QQQ 当日收盘小幅下跌，为客观行情事实。",
    citations: { eventKeys: [], sourceUrls: [], candidateMarketDates: [], baselineKeys: ["market:QQQ"] }
  });
  const validation = validateResearchNarrative(narrative, baselinePacket);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
});

test("research narrative contract accepts a baseline source URL and rejects an unrelated one", function () {
  const baselinePacket = {
    ...packet,
    ndxSnapshot: {
      sourceUrl: "https://www.nasdaq.com/docs/2026/05/04/NDX.pdf",
      topMembers: [{ symbol: "NVDA", weightPercent: 8.42 }]
    }
  };
  const ok = validNarrative();
  ok.claims.push({
    id: "ndx-weight",
    text: "英伟达在 Nasdaq-100 中权重约 8.42%，为官方成分快照事实。",
    citations: {
      eventKeys: [],
      sourceUrls: ["https://www.nasdaq.com/docs/2026/05/04/NDX.pdf"],
      candidateMarketDates: [],
      baselineKeys: ["ndx-weights"]
    }
  });
  const okValidation = validateResearchNarrative(ok, baselinePacket);
  assert.equal(okValidation.valid, true);
  assert.deepEqual(okValidation.errors, []);

  const bad = validNarrative();
  bad.claims.push({
    id: "ndx-weight-bad",
    text: "权重引用了不相关的来源。",
    citations: {
      eventKeys: [],
      sourceUrls: ["https://example.com/unrelated"],
      candidateMarketDates: [],
      baselineKeys: ["ndx-weights"]
    }
  });
  const badValidation = validateResearchNarrative(bad, baselinePacket);
  assert.equal(badValidation.valid, false);
  assert.ok(badValidation.errors.some(function (error) { return /not attached to a cited event or baseline/.test(error); }));
});

test("research narrative contract rejects unknown baseline keys", function () {
  const narrative = validNarrative();
  narrative.claims[0].citations = { eventKeys: [], sourceUrls: [], candidateMarketDates: [], baselineKeys: ["market:TSLA"] };
  const validation = validateResearchNarrative(narrative, packet);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(function (error) { return /unknown baseline fact/.test(error); }));
});

test("research narrative contract rejects citations to events rejected by human review", function () {
  const rejectedPacket = {
    ...packet,
    events: [{
      ...packet.events[0],
      review: { status: "rejected" }
    }]
  };
  const validation = validateResearchNarrative(validNarrative(), rejectedPacket);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(function (error) { return /unknown event key/.test(error); }));
  const instructions = buildResearchNarrativeInstructions(rejectedPacket);
  assert.deepEqual(instructions.allowedEvidence.eventKeys, []);
});

test("research narrative audit fingerprints both accepted and rejected output", function () {
  const valid = validateResearchNarrative(validNarrative(), packet);
  const accepted = buildNarrativeAuditRecord(packet, validNarrative(), valid, { provider: "DeepSeek", model: "example" });
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.packet_fingerprint.length, 64);
  assert.equal(accepted.output_fingerprint.length, 64);
  assert.equal(accepted.provider, "DeepSeek");
  assert.equal(accepted.failure_code, null);
  assert.deepEqual(accepted.metadata, {
    runId: null,
    generatedAt: accepted.metadata.generatedAt,
    latencyMs: null,
    inputTokens: null,
    outputTokens: null,
    temperature: null
  });

  const invalid = validateResearchNarrative({}, packet);
  const rejected = buildNarrativeAuditRecord(packet, {}, invalid);
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.failure_code, "narrative_contract_invalid");
  assert.ok(rejected.validation_errors.length > 0);

  const providerRejected = buildNarrativeAuditRecord(packet, {}, invalid, { failureCode: "model_response_incomplete" });
  assert.equal(providerRejected.failure_code, "model_response_incomplete");
  const unknownRejected = buildNarrativeAuditRecord(packet, {}, invalid, { failureCode: "private-upstream-detail" });
  assert.equal(unknownRejected.failure_code, "narrative_contract_invalid");
});

test("research narrative audit uses the same stable fact fingerprint as a replay snapshot", function () {
  const first = { ...packet, generatedAt: "2026-08-11T20:00:00.000Z" };
  const second = { ...packet, generatedAt: "2026-08-11T22:00:00.000Z" };
  const validation = validateResearchNarrative(validNarrative(), first);
  const audit = buildNarrativeAuditRecord(first, validNarrative(), validation, {});
  assert.equal(researchPacketFingerprint(first), researchPacketFingerprint(second));
  assert.equal(audit.packet_fingerprint, researchPacketFingerprint(second));
});

test("research narrative audit metadata never retains credentials or arbitrary upstream responses", function () {
  const metadata = sanitizeAuditMetadata({
    runId: "run-123",
    latencyMs: 432,
    inputTokens: 12,
    outputTokens: 34,
    temperature: 0.2,
    apiKey: "secret-value",
    authorization: "Bearer secret-value",
    upstreamResponse: { sensitive: true }
  });
  assert.equal(metadata.runId, "run-123");
  assert.equal(metadata.latencyMs, 432);
  assert.equal("apiKey" in metadata, false);
  assert.equal("authorization" in metadata, false);
  assert.equal("upstreamResponse" in metadata, false);
});
