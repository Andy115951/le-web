const assert = require("node:assert/strict");
const test = require("node:test");
const {
  FRED_SERIES,
  buildFredObservationRecords,
  collectRecentFredObservations,
  getFredApiKey,
  normalizeObservations
} = require("../lib/fred-macro");

const payload = {
  observations: [
    { realtime_start: "2026-08-11", realtime_end: "9999-12-31", date: "2026-07-01", value: "323.976" },
    { realtime_start: "2026-07-10", realtime_end: "2026-08-10", date: "2026-06-01", value: "322.561" },
    { realtime_start: "2026-06-11", realtime_end: "2026-07-09", date: "2026-05-01", value: "." }
  ]
};

test("FRED observations retain release-period dates without inventing a release timestamp", function () {
  const observations = normalizeObservations(payload, FRED_SERIES[0]);
  assert.equal(observations.length, 2);
  assert.equal(observations[0].seriesId, "CPIAUCSL");
  assert.equal(observations[0].sourceUrl, "https://fred.stlouisfed.org/series/CPIAUCSL");

  const records = buildFredObservationRecords(observations, new Date("2026-08-11T22:00:00.000Z"));
  assert.equal(records.events.length, 2);
  assert.equal(records.sources.length, 1);
  assert.deepEqual(records.entityLinks, []);
  assert.equal(records.events[0].event_time, null);
  assert.equal(records.events[0].available_at, "2026-08-11T22:00:00.000Z");
  assert.equal(records.events[0].market_date, "2026-08-11");
  assert.match(records.events[0].attributes.timeSemantics, /does not include a precise release timestamp/);
});

test("FRED collection uses a server-only key and does not expose it in persisted source URLs", async function () {
  const requests = [];
  const fetchImpl = async function (url) {
    requests.push(url);
    return { ok: true, status: 200, statusText: "OK", json: async function () { return payload; } };
  };
  const result = await collectRecentFredObservations({
    env: { FRED_API_KEY: "a".repeat(32) },
    series: [FRED_SERIES[0]],
    fetchImpl
  });
  assert.equal(result.observations.length, 2);
  assert.equal(requests.length, 1);
  assert.match(requests[0], /api_key=/);
  const records = buildFredObservationRecords(result.observations, new Date("2026-08-11T22:00:00.000Z"));
  assert.equal(records.sources[0].canonical_url.includes("api_key"), false);
});

test("FRED collector rejects a missing or malformed API key", function () {
  assert.throws(function () { getFredApiKey({}); }, /FRED_API_KEY/);
  assert.throws(function () { getFredApiKey({ FRED_API_KEY: "uppercase-key" }); }, /32-character/);
});
