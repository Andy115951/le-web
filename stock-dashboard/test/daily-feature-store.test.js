const assert = require("node:assert/strict");
const test = require("node:test");
const { getStoredDailyFeatures, normalizeFeatureDate } = require("../lib/daily-feature-store");

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
