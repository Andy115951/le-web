const test = require("node:test");
const assert = require("node:assert/strict");
const { isRelevantNewsTitle } = require("../lib/daily-market-events");

test("news relevance accepts explicit company and Nasdaq references", function () {
  assert.equal(isRelevantNewsTitle("Nvidia launches its next AI platform", "NVDA"), true);
  assert.equal(isRelevantNewsTitle("AMD Q2 earnings call transcript", "AMD"), true);
  assert.equal(isRelevantNewsTitle("Nasdaq-100 slips before CPI data", "QQQ"), true);
  assert.equal(isRelevantNewsTitle("Alphabet expands Google Cloud capacity", "GOOGL"), true);
});

test("news relevance rejects unrelated ticker-search noise", function () {
  assert.equal(isRelevantNewsTitle("Curaleaf announces a takeover bid for Aurora Cannabis", "NVDA"), false);
  assert.equal(isRelevantNewsTitle("Owlet reports record quarterly revenue", "AMZN"), false);
  assert.equal(isRelevantNewsTitle("Helfie appoints new directors", "AAPL"), false);
});
