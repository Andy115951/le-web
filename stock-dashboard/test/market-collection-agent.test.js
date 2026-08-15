const assert = require("node:assert/strict");
const test = require("node:test");
const {
  MARKET_COLLECTION_AGENT_VERSION,
  normalizePublicSymbols,
  runMarketCollectionAgent
} = require("../lib/market-collection-agent");
const { runResearchTaskWithRetry } = require("../lib/research-task-runs");

test("market collector keeps its public universe bounded", function () {
  assert.equal(MARKET_COLLECTION_AGENT_VERSION, "market-collection-agent-v1");
  assert.deepEqual(normalizePublicSymbols(["QQQ", "private", "NVDA", "qqq"]), ["NVDA", "QQQ"]);
});

test("market collector skips stale snapshots without writes", async function () {
  let wrote = false;
  const result = await runMarketCollectionAgent({
    now: new Date("2026-08-15T22:00:00.000Z"),
    marketDate: "2026-08-15",
    config: {},
    getDailyMarketEvents: async function () {
      return { date: "2026-08-14", events: [], failedSymbols: [], universe: { asOf: "2026-08-01", instruments: [{ symbol: "QQQ" }] } };
    },
    requestImpl: async function () { wrote = true; },
    persistUnifiedMarketEvents: async function () { wrote = true; }
  });
  assert.equal(result.status, "skipped");
  assert.equal(result.publicRowsWritten, 0);
  assert.equal(wrote, false);
});

test("market collector persists only public history and unified event rows", async function () {
  const requests = [];
  const result = await runMarketCollectionAgent({
    now: new Date("2026-08-15T22:00:00.000Z"),
    marketDate: "2026-08-15",
    config: { marker: "test" },
    getDailyMarketEvents: async function () {
      return {
        date: "2026-08-15",
        failedSymbols: ["PRIVATE"],
        universe: { asOf: "2026-08-01", instruments: [{ symbol: "QQQ", role: "benchmark" }] },
        events: [{ date: "2026-08-15", symbol: "QQQ", name: "QQQ", reasons: [], news: [], capturedAt: "2026-08-15T21:00:00.000Z" }]
      };
    },
    requestImpl: async function (config, path, options) { requests.push({ config, path, options }); },
    persistUnifiedMarketEvents: async function () { return { eventsWritten: 1, sourcesWritten: 2 }; }
  });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.publicFailedSymbols, []);
  assert.equal(result.publicRowsWritten, 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.body[0].user_id, undefined);
});

test("collector work is retried only after a retryable transient failure", async function () {
  let calls = 0;
  const result = await runResearchTaskWithRetry({
    queuedAt: "2026-08-15T22:00:00.000Z",
    wait: async function () {},
    run: async function () {
      calls += 1;
      if (calls === 1) throw new Error("network timeout");
      return { status: "succeeded" };
    }
  });
  assert.equal(result.status, "succeeded");
  assert.equal(calls, 2);
  assert.equal(result.attempts.length, 2);
  assert.equal(result.attempts[0].failureCode, "retryable_task_failure");
});
