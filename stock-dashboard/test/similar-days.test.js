const assert = require("node:assert/strict");
const test = require("node:test");
const { MIN_CANDIDATE_SEPARATION, findSimilarDays } = require("../lib/similar-days");

function feature(index) {
  const date = new Date(Date.UTC(2020, 0, 1 + index)).toISOString().slice(0, 10);
  return {
    market_date: date,
    return_1d_percent: ((index % 9) - 4) / 2,
    return_5d_percent: ((index % 13) - 6) / 2,
    return_20d_percent: ((index % 17) - 8) / 2,
    gap_percent: ((index % 7) - 3) / 3,
    trailing_volatility_20d_percent: 14 + (index % 11),
    trailing_drawdown_20d_percent: -1 * (index % 9),
    volume_ratio_20d_percent: ((index % 15) - 7) * 3,
    available_event_count: 0,
    high_impact_event_count: 0,
    medium_impact_event_count: 0,
    low_impact_event_count: 0,
    event_ticker_count: 0
  };
}

function label(index) {
  return {
    market_date: new Date(Date.UTC(2020, 0, 1 + index)).toISOString().slice(0, 10),
    return_1d_percent: index / 10,
    return_3d_percent: index / 9,
    return_5d_percent: index / 8,
    return_20d_percent: index / 7,
    max_drawdown_20d_percent: -index / 20,
    realized_volatility_20d_percent: 15
  };
}

test("similar days use only history available by the target date", function () {
  const features = Array.from({ length: 130 }, function (_, index) { return feature(index); });
  const labels = Array.from({ length: 130 }, function (_, index) { return label(index); });
  const targetDate = features[110].market_date;
  const first = findSimilarDays({ features, labels, targetDate, maxResults: 5 });
  features.slice(111).forEach(function (row) {
    row.return_1d_percent = 10000;
    row.trailing_volatility_20d_percent = 9999;
    row.volume_ratio_20d_percent = -9999;
  });
  const second = findSimilarDays({ features, labels, targetDate, maxResults: 5 });
  assert.deepEqual(
    first.matches.map(function (match) { return [match.candidate.market_date, match.score]; }),
    second.matches.map(function (match) { return [match.candidate.market_date, match.score]; })
  );
  assert.equal(first.normalization.endDate, features[109].market_date);
});

test("similar days require mature outcomes and avoid adjacent duplicate regimes", function () {
  const features = Array.from({ length: 150 }, function (_, index) { return feature(index); });
  const labels = Array.from({ length: 150 }, function (_, index) { return label(index); });
  const targetIndex = 120;
  const result = findSimilarDays({ features, labels, targetDate: features[targetIndex].market_date, maxResults: 5 });
  assert.ok(result.matches.length > 0);
  result.matches.forEach(function (match) {
    const candidateIndex = features.findIndex(function (item) { return item.market_date === match.candidate.market_date; });
    assert.ok(candidateIndex + 20 <= targetIndex);
    assert.ok(match.outcome.return20dPercent !== null);
  });
  for (let index = 1; index < result.matches.length; index += 1) {
    const previous = features.findIndex(function (item) { return item.market_date === result.matches[index - 1].candidate.market_date; });
    const current = features.findIndex(function (item) { return item.market_date === result.matches[index].candidate.market_date; });
    assert.ok(Math.abs(previous - current) >= MIN_CANDIDATE_SEPARATION);
  }
});

test("similar days report an explicit no-result state with insufficient history", function () {
  const features = Array.from({ length: 30 }, function (_, index) { return feature(index); });
  const result = findSimilarDays({ features, labels: features, targetDate: features.at(-1).market_date });
  assert.equal(result.matches.length, 0);
  assert.match(result.reason, /Insufficient/);
});
