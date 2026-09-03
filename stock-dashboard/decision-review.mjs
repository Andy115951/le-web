import { getActiveDecisionLogs } from "./decision-logs.mjs";

const OUTCOMES = ["pending", "worked", "mixed", "wrong"];

function emptyOutcomeCounts() {
  return { pending: 0, worked: 0, mixed: 0, wrong: 0 };
}

function compareGroups(left, right) {
  return right.total - left.total
    || right.reviewed - left.reviewed
    || String(left.key).localeCompare(String(right.key));
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function metricComparison(start, end, decimals = 4) {
  const from = finiteNumber(start);
  const to = finiteNumber(end);
  if (from === null || to === null) return null;
  const change = Number((to - from).toFixed(decimals));
  return { from, to, change };
}

// A comparison is intentionally descriptive: it never turns a later price or
// position change into a verdict on the user's earlier decision.
export function buildDecisionSnapshotComparison(entry) {
  const start = entry?.snapshot;
  const end = entry?.outcomeSnapshot;
  if (!start || !end || entry?.outcome === "pending") return null;
  const price = metricComparison(start.price, end.price);
  if (price && price.from > 0) price.changePercent = Number(((price.change / price.from) * 100).toFixed(3));
  const shares = metricComparison(start.shares, end.shares);
  const costBasis = metricComparison(start.costBasis, end.costBasis);
  if (!price && !shares && !costBasis) return null;
  return { price, shares, costBasis };
}

// This is a journal review, not a strategy score. It only counts outcomes the
// user explicitly recorded, so incomplete logs remain visible as pending.
export function buildDecisionReview(logs) {
  const entries = getActiveDecisionLogs(logs);
  const outcomes = emptyOutcomeCounts();
  const actions = new Map();
  const symbols = new Map();
  const comparisons = {
    completed: 0,
    snapshotComparable: 0,
    priceComparable: 0,
    priceUp: 0,
    priceDown: 0,
    priceFlat: 0,
    sharesComparable: 0
  };

  entries.forEach(function (entry) {
    const outcome = OUTCOMES.includes(entry.outcome) ? entry.outcome : "pending";
    outcomes[outcome] += 1;
    if (outcome !== "pending") comparisons.completed += 1;
    const comparison = buildDecisionSnapshotComparison(entry);
    if (comparison) {
      comparisons.snapshotComparable += 1;
      if (comparison.price) {
        comparisons.priceComparable += 1;
        if (comparison.price.change > 0) comparisons.priceUp += 1;
        else if (comparison.price.change < 0) comparisons.priceDown += 1;
        else comparisons.priceFlat += 1;
      }
      if (comparison.shares) comparisons.sharesComparable += 1;
    }

    const action = actions.get(entry.action) || { key: entry.action, total: 0, reviewed: 0 };
    action.total += 1;
    if (outcome !== "pending") action.reviewed += 1;
    actions.set(entry.action, action);

    const symbol = symbols.get(entry.symbol) || {
      key: entry.symbol,
      displayName: entry.displayName || entry.symbol,
      total: 0,
      reviewed: 0,
      outcomes: emptyOutcomeCounts(),
      latestMarketDate: entry.marketDate
    };
    symbol.total += 1;
    symbol.outcomes[outcome] += 1;
    if (outcome !== "pending") symbol.reviewed += 1;
    if (entry.marketDate > symbol.latestMarketDate) symbol.latestMarketDate = entry.marketDate;
    symbols.set(entry.symbol, symbol);
  });

  const reviewed = outcomes.worked + outcomes.mixed + outcomes.wrong;
  return {
    total: entries.length,
    reviewed,
    outcomes,
    comparisons,
    actions: Array.from(actions.values()).sort(compareGroups),
    symbols: Array.from(symbols.values()).sort(compareGroups)
  };
}
