const test = require("node:test");
const assert = require("node:assert/strict");
const {
  NASDAQ_FOCUS_INSTRUMENTS,
  NASDAQ_UNIVERSE_AS_OF,
  NASDAQ_UNIVERSE_SOURCE,
  getNasdaqFocusSymbols
} = require("../lib/nasdaq-universe");

test("Nasdaq focus universe is bounded and contains its benchmark", function () {
  const symbols = getNasdaqFocusSymbols();
  assert.equal(symbols[0], "QQQ");
  assert.equal(new Set(symbols).size, symbols.length);
  assert.ok(symbols.length <= 16);
  assert.ok(symbols.includes("NVDA"));
  assert.ok(symbols.includes("AAPL"));
  assert.equal(NASDAQ_FOCUS_INSTRUMENTS.length, symbols.length);
  assert.match(NASDAQ_UNIVERSE_AS_OF, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(NASDAQ_UNIVERSE_SOURCE, /^https:\/\/indexes\.nasdaq\.com\//);
});
