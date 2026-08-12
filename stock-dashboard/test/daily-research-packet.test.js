const assert = require("node:assert/strict");
const test = require("node:test");
const { buildDailyResearchPacket, isAvailableByMarketClose } = require("../lib/daily-research-packet");

const date = "2026-08-11";

function event(key, availableAt) {
  return {
    event_key: key,
    event_type: "sec_filing",
    title: key,
    summary: "Official filing.",
    event_time: availableAt,
    available_at: availableAt,
    captured_at: "2026-08-12T00:00:00.000Z",
    impact_scope: "instrument",
    impact_level: "medium",
    confidence: 0.95,
    tickers: ["NVDA"],
    themes: ["sec_filing"],
    sources: [{
      provider: "SEC EDGAR",
      title: "NVDA 8-K filing",
      canonical_url: "https://www.sec.gov/Archives/example.htm",
      source_kind: "filing",
      published_at: availableAt,
      available_at: availableAt,
      relationType: "primary"
    }]
  };
}

test("daily research packet excludes labels and events learned after New York close", function () {
  const beforeClose = event("before-close", "2026-08-11T19:59:00.000Z");
  const afterClose = event("after-close", "2026-08-11T20:01:00.000Z");
  const packet = buildDailyResearchPacket({
    date,
    generatedAt: "2026-08-12T00:00:00.000Z",
    detail: {
      day: {
        qqq: { adjustedClose: 600, changePercent: 0.5, trailingVolatility20dPercent: 18, volatilityLevel: "normal" },
        eventSummary: { count: 2, highestImpact: "medium", types: ["sec_filing"], symbols: ["NVDA"] },
        researchOutcome: { return20dPercent: 12 }
      },
      events: [beforeClose, afterClose],
      ndxSnapshot: { effectiveDate: "2026-05-01", sourceUrl: "https://example.com/ndx", constituentCount: 101, totalWeightPercent: 99.96, topMembers: [] }
    },
    similar: {
      methodVersion: "qqq-price-state-v1",
      target: { feature_version: "qqq-daily-state-v1" },
      summary: { candidateCount: 1 },
      matches: [{ rank: 1, candidate_market_date: "2024-01-01", similarity_score: 80, candidate_return_20d_percent: 2 }]
    }
  });
  assert.equal(packet.events.length, 1);
  assert.equal(packet.events[0].eventKey, "before-close");
  assert.equal(packet.marketState.eventSummary.count, 1);
  assert.equal(packet.marketState.adjustedClose, 600);
  assert.equal(packet.historicalSimilarity.matches[0].historicalOutcome.return20dPercent, 2);
  assert.equal("researchOutcome" in packet, false);
  assert.match(packet.asOf.excluded.join(" "), /forward returns/);
});

test("daily research packet uses the daylight-safe New York close cutoff", function () {
  assert.equal(isAvailableByMarketClose({ available_at: "2026-01-12T21:00:00.000Z" }, "2026-01-12"), true);
  assert.equal(isAvailableByMarketClose({ available_at: "2026-01-12T21:01:00.000Z" }, "2026-01-12"), false);
  assert.equal(isAvailableByMarketClose({ available_at: "2026-07-13T20:00:00.000Z" }, "2026-07-13"), true);
  assert.equal(isAvailableByMarketClose({ available_at: "2026-07-13T20:01:00.000Z" }, "2026-07-13"), false);
});
