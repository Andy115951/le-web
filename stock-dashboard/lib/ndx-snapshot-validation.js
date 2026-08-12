const { canonicalizeSourceUrl } = require("./unified-market-events");

function round(value, digits = 6) {
  return Number(Number(value).toFixed(digits));
}

function validateSnapshot(input) {
  const snapshot = input && typeof input === "object" ? input : {};
  const indexSymbol = String(snapshot.indexSymbol || "").trim().toUpperCase();
  const effectiveDate = String(snapshot.effectiveDate || "").trim();
  const constituents = Array.isArray(snapshot.constituents) ? snapshot.constituents : [];
  if (indexSymbol !== "NDX") throw new Error("Only NDX snapshots are supported");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) throw new Error("Invalid snapshot effective date");
  if (constituents.length < 100 || constituents.length > 110) throw new Error("NDX snapshot must contain 100-110 securities");
  const symbols = new Set();
  const normalized = constituents.map(function (item) {
    const symbol = String(item?.symbol || "").trim().toUpperCase();
    const name = String(item?.name || "").trim();
    const weightPercent = Number(item?.weightPercent);
    if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) throw new Error("Invalid NDX symbol: " + symbol);
    if (symbols.has(symbol)) throw new Error("Duplicate NDX symbol: " + symbol);
    if (!name) throw new Error("Missing NDX security name: " + symbol);
    if (!Number.isFinite(weightPercent) || weightPercent < 0 || weightPercent > 25) {
      throw new Error("Invalid NDX weight: " + symbol);
    }
    symbols.add(symbol);
    return { symbol, name, weightPercent: round(weightPercent) };
  });
  const totalWeightPercent = round(normalized.reduce(function (sum, item) { return sum + item.weightPercent; }, 0));
  if (totalWeightPercent < 99 || totalWeightPercent > 101) {
    throw new Error("NDX weights must total approximately 100%, received " + totalWeightPercent);
  }
  return {
    indexSymbol,
    effectiveDate,
    publishedAt: snapshot.publishedAt || null,
    sourceUrl: canonicalizeSourceUrl(snapshot.sourceUrl),
    weightPrecision: Number(snapshot.weightPrecision) || 2,
    isProForma: Boolean(snapshot.isProForma),
    constituents: normalized,
    totalWeightPercent
  };
}

module.exports = { round, validateSnapshot };
