const assert = require("node:assert/strict");
const test = require("node:test");
const { EVENT_LABELER_AGENT_VERSION, buildEventRuleLabelRecords, persistEventRuleLabels, runEventLabelerAgent } = require("../lib/event-labeler-agent");

const EVENT_ID = "11111111-1111-4111-8111-111111111111";

function event(overrides = {}) {
  return {
    id: EVENT_ID,
    event_key: "market-move:2026-08-13:QQQ:v1",
    market_date: "2026-08-13",
    event_type: "market_move_attribution",
    confidence: 0.65,
    available_at: "2026-08-13T20:00:00.000Z",
    sources: [{ relationType: "primary" }],
    ...overrides
  };
}

test("event labeler records only safe deterministic review flags", function () {
  const records = buildEventRuleLabelRecords([event()], new Date("2026-08-14T00:00:00.000Z"));
  assert.equal(records.length, 1);
  assert.equal(records[0].label_version, EVENT_LABELER_AGENT_VERSION);
  assert.equal(records[0].suggested_status, "needs_attention");
  assert.equal(records[0].requires_review, true);
  assert.deepEqual(records[0].flags, [
    { code: "low_confidence", severity: "medium" },
    { code: "heuristic_market_attribution", severity: "medium" }
  ]);
  assert.equal(records[0].input_fingerprint.length, 64);
  assert.equal(JSON.stringify(records[0]).includes("market-move:"), false);
});

test("event labeler appends by input fingerprint without touching human review decisions", async function () {
  let request;
  const saved = await persistEventRuleLabels({}, buildEventRuleLabelRecords([event()]), async function (_config, path, options) {
    request = { path, options };
    return [{ id: "saved" }];
  });
  assert.equal(saved.written, 1);
  assert.match(request.path, /on_conflict=event_id,label_version,input_fingerprint/);
  assert.equal(request.options.headers.Prefer, "resolution=ignore-duplicates,return=representation");
  assert.equal(request.path.includes("event_review_decisions"), false);
});

test("event labeler runs independently for the captured market date", async function () {
  const result = await runEventLabelerAgent({
    marketDate: "2026-08-13",
    now: new Date("2026-08-14T00:00:00.000Z"),
    config: {},
    getEvents: async function (start, end, options) {
      assert.equal(start, "2026-08-13");
      assert.equal(end, "2026-08-13");
      assert.equal(options.includeRelations, true);
      return [event()];
    },
    persist: async function (_config, records) {
      assert.equal(records.length, 1);
      return { written: 1 };
    }
  });
  assert.deepEqual(result, {
    status: "succeeded",
    labelVersion: EVENT_LABELER_AGENT_VERSION,
    processedEvents: 1,
    labelsWritten: 1,
    requiresReviewCount: 1
  });
});
