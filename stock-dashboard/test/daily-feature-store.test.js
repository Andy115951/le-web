const assert = require("node:assert/strict");
const test = require("node:test");
const { getStoredDailyFeatures, normalizeFeatureDate, rebuildDailyFeatures } = require("../lib/daily-feature-store");

test("feature date normalization rejects impossible dates", function () {
  assert.equal(normalizeFeatureDate("2026-08-11"), "2026-08-11");
  assert.equal(normalizeFeatureDate(), "");
  assert.throws(function () { normalizeFeatureDate("2026-02-31"); }, /Invalid feature date/);
});

test("stored feature reads page past the Supabase 1,000 row response cap", async function () {
  const originalFetch = global.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SECRET_KEY;
  const calls = [];
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "server-secret";
  global.fetch = async function (url) {
    calls.push(url);
    if (url.includes("/instruments?")) {
      return { ok: true, text: async function () { return JSON.stringify([{ id: 1, symbol: "QQQ", display_name: "Invesco QQQ Trust" }]); } };
    }
    const offset = Number(new URL(url).searchParams.get("offset"));
    const length = offset === 0 ? 1000 : 254;
    const payload = Array.from({ length }, function (_, index) {
      return { market_date: String(offset + index).padStart(4, "0") };
    });
    return { ok: true, text: async function () { return JSON.stringify(payload); } };
  };

  try {
    const result = await getStoredDailyFeatures("QQQ", 1254);
    assert.equal(result.features.length, 1254);
    assert.equal(calls.length, 3);
    assert.match(calls[1], /offset=0/);
    assert.match(calls[2], /offset=1000/);
    assert.equal(result.features[0].market_date, "1253");
    assert.equal(result.features.at(-1).market_date, "0000");
  } finally {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = originalKey;
  }
});

test("feature rebuild merges exact-time reported earnings into the persisted feature rows", async function () {
  let persisted = [];
  const result = await rebuildDailyFeatures("QQQ", {
    getSupabaseConfig: function () { return { test: true }; },
    now: new Date("2026-09-02T00:00:00.000Z"),
    getStoredDailyPrices: async function () {
      return {
        instrument: { id: 7, symbol: "QQQ" },
        prices: [
          { market_date: "2026-07-29", open: 99, high: 101, low: 98, close: 100, adjusted_close: 100, volume: 1000, source: "test", captured_at: "2026-07-29T20:00:00.000Z" },
          { market_date: "2026-07-30", open: 100, high: 102, low: 99, close: 101, adjusted_close: 101, volume: 1100, source: "test", captured_at: "2026-07-30T20:00:00.000Z" }
        ]
      };
    },
    getUnifiedMarketEventsRange: async function () { return []; },
    getReportedEarningsFeatureEvents: async function () {
      return [{
        event_key: "earnings_calendar:earnings:META:example",
        market_date: "2026-07-29",
        available_at: "2026-07-29T21:00:00.000Z",
        event_type: "earnings_reported",
        impact_level: "unknown",
        tickers: ["META"]
      }];
    },
    upsertFeatures: async function (_config, rows) { persisted = rows; }
  });

  assert.equal(result.reportedEarningsFeatureEvents, 1);
  assert.equal(result.knownEventDays, 1);
  assert.equal(persisted.length, 2);
  assert.equal(persisted[0].available_event_count, 0);
  assert.deepEqual(persisted[1].event_type_counts, { earnings_reported: 1 });
});
