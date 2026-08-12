const assert = require("node:assert/strict");
const test = require("node:test");
const { getStoredDailyPrices, normalizeHistoryLimit } = require("../lib/price-history-store");

test("history limit has safe defaults and bounded public output", function () {
  assert.equal(normalizeHistoryLimit(), 365);
  assert.equal(normalizeHistoryLimit("1250"), 1250);
  assert.equal(normalizeHistoryLimit(1), 30);
  assert.equal(normalizeHistoryLimit(10000), 2600);
});

test("stored history reads past the Supabase 1,000 row response cap", async function () {
  const originalFetch = global.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SECRET_KEY;
  const calls = [];
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "server-secret";
  global.fetch = async function (url) {
    calls.push(url);
    let payload;
    if (url.includes("/instruments?")) {
      payload = [{ id: 1, symbol: "QQQ", display_name: "Invesco QQQ Trust" }];
    } else {
      const offset = Number(new URL(url).searchParams.get("offset"));
      const length = offset === 0 ? 1000 : 254;
      payload = Array.from({ length }, function (_, index) {
        return { market_date: String(offset + index).padStart(4, "0") };
      });
    }
    return { ok: true, text: async function () { return JSON.stringify(payload); } };
  };

  try {
    const result = await getStoredDailyPrices("QQQ", 1254);
    assert.equal(result.prices.length, 1254);
    assert.equal(calls.length, 3);
    assert.match(calls[1], /offset=0/);
    assert.match(calls[2], /offset=1000/);
    assert.equal(result.prices[0].market_date, "1253");
    assert.equal(result.prices.at(-1).market_date, "0000");
  } finally {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = originalKey;
  }
});
