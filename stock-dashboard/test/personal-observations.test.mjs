import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPersonalObservations,
  mergePersonalObservations,
  normalizePersonalObservations
} from "../personal-observations.mjs";

const capturedAt = "2026-08-15T16:00:00.000Z";

test("buildPersonalObservations records deterministic personal triggers", function () {
  const observations = buildPersonalObservations({
    marketDate: "2026-08-15",
    capturedAt,
    strategyRules: [{ drawdown: 8, sellPercent: 20 }],
    items: [{ symbol: "NVDA", displayName: "NVIDIA", targetPrice: 91 }],
    peaks: { NVDA: { peakPrice: 100 } },
    quotes: {
      QQQ: { changePercent: -1 },
      NVDA: { name: "NVIDIA", price: 90, previousClose: 95, changePercent: -4 }
    }
  });

  assert.deepEqual(observations.map(function (entry) { return entry.kind; }).sort(), [
    "daily_drop",
    "drawdown_rule",
    "relative_weakness",
    "target_hit"
  ]);
  assert.equal(observations.find(function (entry) { return entry.kind === "drawdown_rule"; }).metrics.drawdownPercent, 10);
  assert.match(observations.find(function (entry) { return entry.kind === "target_hit"; }).detail, /不代表自动买卖/);
});

test("mergePersonalObservations keeps the first captured record for an existing trigger", function () {
  const first = buildPersonalObservations({
    marketDate: "2026-08-15",
    capturedAt,
    items: [{ symbol: "NVDA", targetPrice: 100 }],
    peaks: {},
    quotes: { NVDA: { price: 101, previousClose: 99, changePercent: 1 } }
  });
  const second = buildPersonalObservations({
    marketDate: "2026-08-15",
    capturedAt: "2026-08-15T20:00:00.000Z",
    items: [{ symbol: "NVDA", targetPrice: 100 }],
    peaks: {},
    quotes: { NVDA: { price: 102, previousClose: 99, changePercent: 1 } }
  });
  const merged = mergePersonalObservations(first, second, new Date("2026-08-16T00:00:00.000Z").getTime());

  assert.equal(merged.length, 1);
  assert.equal(merged[0].capturedAt, capturedAt);
  assert.equal(merged[0].metrics.currentPrice, 101);
});

test("normalizePersonalObservations expires records older than 90 days", function () {
  const now = new Date("2026-08-15T16:00:00.000Z").getTime();
  const observations = normalizePersonalObservations([
    {
      marketDate: "2026-05-16",
      capturedAt: "2026-05-16T16:00:00.000Z",
      symbol: "NVDA",
      kind: "daily_drop"
    },
    {
      marketDate: "2026-08-15",
      capturedAt,
      symbol: "NVDA",
      kind: "daily_drop"
    }
  ], now);

  assert.equal(observations.length, 1);
  assert.equal(observations[0].marketDate, "2026-08-15");
});
