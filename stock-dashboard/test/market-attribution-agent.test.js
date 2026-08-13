const assert = require("node:assert/strict");
const test = require("node:test");
const {
  MARKET_ATTRIBUTION_AGENT_VERSION,
  attributionInputFingerprint,
  buildAttributionInput,
  buildMarketEventAttributionRecords,
  classifyAttribution,
  getMarketEventAttributions,
  persistMarketEventAttributions,
  runMarketAttributionAgent
} = require("../lib/market-attribution-agent");

const EVENT_ID = "11111111-1111-4111-8111-111111111111";

function event(overrides = {}) {
  return {
    id: EVENT_ID,
    event_key: "market-move:2026-08-12:NVDA:v1",
    market_date: "2026-08-12",
    confidence: 0.65,
    attributes: { changePercent: 2.2, benchmarkChangePercent: 0.8, driverType: "company" },
    sources: [
      { relationType: "primary" },
      { relationType: "evidence" }
    ],
    ...overrides
  };
}

test("deterministic attribution only accepts the structured evidence that supports its category", function () {
  const company = classifyAttribution(buildAttributionInput(event()));
  assert.deepEqual(company, {
    classification: "company",
    confidence: 0.65,
    hypothesisCode: "company_relative_move_with_evidence"
  });

  const market = classifyAttribution(buildAttributionInput(event({
    attributes: { changePercent: -1.1, benchmarkChangePercent: -0.8, driverType: "market" },
    sources: [{ relationType: "primary" }]
  })));
  assert.deepEqual(market, {
    classification: "market",
    confidence: 0.55,
    hypothesisCode: "market_aligned_with_benchmark"
  });

  const mixed = classifyAttribution(buildAttributionInput(event({
    attributes: { changePercent: 1.8, benchmarkChangePercent: 0.7, driverType: "mixed" }
  })));
  assert.equal(mixed.classification, "mixed");

  const unsupported = classifyAttribution(buildAttributionInput(event({
    attributes: { changePercent: 2.2, benchmarkChangePercent: 0.8, driverType: "company" },
    sources: [{ relationType: "primary" }]
  })));
  assert.deepEqual(unsupported, {
    classification: "insufficient_evidence",
    confidence: 0.35,
    hypothesisCode: "insufficient_structured_evidence"
  });
});

test("attribution records are append-only by version and structured-input fingerprint", function () {
  const first = buildMarketEventAttributionRecords([event()], new Date("2026-08-13T00:00:00.000Z"));
  const changed = buildMarketEventAttributionRecords([event({
    sources: [{ relationType: "primary" }, { relationType: "evidence" }, { relationType: "evidence" }]
  })], new Date("2026-08-13T00:00:00.000Z"));
  assert.equal(first.length, 1);
  assert.equal(first[0].attribution_version, MARKET_ATTRIBUTION_AGENT_VERSION);
  assert.equal(first[0].classification, "company");
  assert.equal(first[0].input_fingerprint.length, 64);
  assert.notEqual(first[0].input_fingerprint, changed[0].input_fingerprint);
  assert.equal(JSON.stringify(first[0]).includes("market-move:"), false);
  assert.equal(JSON.stringify(first[0]).includes("https://"), false);
  assert.equal(attributionInputFingerprint(buildAttributionInput(event())).length, 64);
});

test("attribution persistence ignores an exact immutable input and returns only new rows", async function () {
  let request;
  const result = await persistMarketEventAttributions({}, buildMarketEventAttributionRecords([event()]), async function (_config, path, options) {
    request = { path, options };
    return [{ id: "saved" }];
  });
  assert.equal(result.written, 1);
  assert.match(request.path, /market_event_attributions\?on_conflict=event_id,attribution_version,input_fingerprint/);
  assert.equal(request.options.headers.Prefer, "resolution=ignore-duplicates,return=representation");
});

test("agent is independently rerunnable and exposes only safe public attribution fields", async function () {
  let persisted = [];
  const result = await runMarketAttributionAgent({
    marketDate: "2026-08-12",
    now: new Date("2026-08-13T00:00:00.000Z"),
    config: {},
    getEvents: async function (start, end, options) {
      assert.equal(start, "2026-08-12");
      assert.equal(end, "2026-08-12");
      assert.equal(options.includeRelations, true);
      return [event()];
    },
    persist: async function (_config, records) {
      persisted = records;
      return { written: 1 };
    }
  });
  assert.equal(result.status, "succeeded");
  assert.equal(result.processedEvents, 1);
  assert.equal(result.attributionsWritten, 1);
  assert.equal(persisted.length, 1);

  const publicResult = await getMarketEventAttributions({ marketDate: "2026-08-12", limit: 5 }, {}, async function (_config, path) {
    assert.match(path, /market_date=eq\.2026-08-12/);
    return [{
      event_id: EVENT_ID,
      market_date: "2026-08-12",
      attribution_version: MARKET_ATTRIBUTION_AGENT_VERSION,
      classification: "company",
      confidence: 0.65,
      hypothesis_code: "company_relative_move_with_evidence",
      primary_source_count: 1,
      evidence_source_count: 1,
      counter_evidence_count: 0,
      computed_at: "2026-08-13T00:00:00.000Z"
    }];
  });
  assert.equal(publicResult.count, 1);
  assert.deepEqual(Object.keys(publicResult.attributions[0]).sort(), [
    "attributionVersion", "classification", "computedAt", "confidence", "counterEvidenceCount",
    "evidenceSourceCount", "hypothesisCode", "marketDate", "primarySourceCount"
  ]);
  assert.equal(JSON.stringify(publicResult).includes(EVENT_ID), false);
});
