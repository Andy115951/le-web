import assert from "node:assert/strict";
import test from "node:test";
import { canLoadSimilarDays, getSimilarDaysUnavailableMessage } from "../lib/calendar-similarity-display.mjs";

test("similar-day queries require a confirmed trading-day price state", function () {
  assert.equal(canLoadSimilarDays({ status: "trading", qqq: { close: 500 } }), true);
  assert.equal(canLoadSimilarDays({ status: "trading", qqq: null }), false);
  assert.equal(canLoadSimilarDays({ status: "market-holiday", qqq: null }), false);
  assert.equal(canLoadSimilarDays({ status: "upcoming", qqq: null }), false);
});

test("non-trading similar-day notices distinguish known holidays from missing data", function () {
  assert.match(getSimilarDaysUnavailableMessage({ status: "market-holiday" }), /全天休市/);
  assert.match(getSimilarDaysUnavailableMessage({ status: "closed-or-missing" }), /尚无确认/);
  assert.match(getSimilarDaysUnavailableMessage({ status: "unrecognized" }), /不会构造/);
});
