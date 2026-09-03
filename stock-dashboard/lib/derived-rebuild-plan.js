const { normalizeSymbol } = require("./historical-market-data");
const { rebuildDailyFeatures } = require("./daily-feature-store");
const { rebuildForwardLabels } = require("./market-label-store");
const { rebuildSimilarDayMatches } = require("./similar-day-store");

const DERIVED_REBUILD_STAGES = [
  { id: "daily_features", label: "daily_market_features" },
  { id: "forward_labels", label: "market_forward_labels" },
  { id: "similar_days", label: "similar_day_matches" }
];

function parseDerivedRebuildArgs(args = []) {
  const values = Array.isArray(args) ? args.map(String) : [];
  const symbols = values.filter(function (value) { return value && !value.startsWith("--"); });
  if (symbols.length > 1) throw new Error("Expected at most one symbol");
  return {
    symbol: normalizeSymbol(symbols[0] || "QQQ"),
    approved: values.includes("--approve")
  };
}

function buildDerivedRebuildPlan(symbol) {
  return {
    symbol: normalizeSymbol(symbol || "QQQ"),
    stages: DERIVED_REBUILD_STAGES.map(function (stage) { return { ...stage }; }),
    writesDatabase: true,
    requiresExplicitApproval: true,
    note: "Runs feature, forward-label, and similar-day rebuilds sequentially. It is not a Cron task."
  };
}

async function runDerivedRebuild(symbol, dependencies = {}) {
  const normalizedSymbol = normalizeSymbol(symbol || "QQQ");
  const rebuildFeatures = dependencies.rebuildFeatures || rebuildDailyFeatures;
  const rebuildLabels = dependencies.rebuildLabels || rebuildForwardLabels;
  const rebuildSimilarDays = dependencies.rebuildSimilarDays || rebuildSimilarDayMatches;
  const features = await rebuildFeatures(normalizedSymbol);
  const labels = await rebuildLabels(normalizedSymbol);
  const similarDays = await rebuildSimilarDays(normalizedSymbol);
  return { symbol: normalizedSymbol, features, labels, similarDays };
}

module.exports = {
  DERIVED_REBUILD_STAGES,
  buildDerivedRebuildPlan,
  parseDerivedRebuildArgs,
  runDerivedRebuild
};
