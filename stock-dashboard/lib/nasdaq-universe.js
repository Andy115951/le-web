const NASDAQ_UNIVERSE_AS_OF = "2026-06-30";
const NASDAQ_UNIVERSE_SOURCE = "https://indexes.nasdaq.com/docs/FS_NDX.pdf";
const { getNdxSnapshot } = require("./ndx-snapshots");

// Keep the live radar deliberately small enough for serverless quote/news limits.
// It combines the official NDX top-weight names with two useful market baskets.
const NASDAQ_FOCUS_INSTRUMENTS = [
  { symbol: "QQQ", name: "Invesco QQQ Trust", role: "benchmark" },
  { symbol: "MAGS", name: "Roundhill Magnificent Seven ETF", role: "basket" },
  { symbol: "NVDA", name: "NVIDIA", role: "component" },
  { symbol: "AAPL", name: "Apple", role: "component" },
  { symbol: "MU", name: "Micron Technology", role: "component" },
  { symbol: "MSFT", name: "Microsoft", role: "component" },
  { symbol: "AMD", name: "Advanced Micro Devices", role: "component" },
  { symbol: "AMZN", name: "Amazon", role: "component" },
  { symbol: "TSLA", name: "Tesla", role: "component" },
  { symbol: "GOOGL", name: "Alphabet Class A", role: "component" },
  { symbol: "GOOG", name: "Alphabet Class C", role: "component" },
  { symbol: "INTC", name: "Intel", role: "component" },
  { symbol: "META", name: "Meta Platforms", role: "related-leader" },
  { symbol: "AVGO", name: "Broadcom", role: "related-leader" }
];

function getNasdaqFocusSymbols() {
  return NASDAQ_FOCUS_INSTRUMENTS.map(function (item) { return item.symbol; });
}

async function getNasdaqFocusUniverse(asOf) {
  try {
    const snapshot = await getNdxSnapshot(asOf);
    if (!snapshot || snapshot.members.length < 10) throw new Error("No complete NDX snapshot available");
    const topComponents = snapshot.members.slice(0, 12).map(function (member) {
      return {
        symbol: member.instruments.symbol,
        name: member.instruments.display_name || member.security_name,
        role: "component",
        weightPercent: Number(member.weight_percent),
        rank: member.rank
      };
    });
    return {
      type: "ndx-weight-snapshot",
      asOf: snapshot.effective_date,
      source: snapshot.source_url,
      instruments: [
        { symbol: "QQQ", name: "Invesco QQQ Trust", role: "benchmark" },
        { symbol: "MAGS", name: "Roundhill Magnificent Seven ETF", role: "basket" }
      ].concat(topComponents)
    };
  } catch {
    return {
      type: "nasdaq-focus-fallback",
      asOf: NASDAQ_UNIVERSE_AS_OF,
      source: NASDAQ_UNIVERSE_SOURCE,
      instruments: NASDAQ_FOCUS_INSTRUMENTS
    };
  }
}

module.exports = {
  NASDAQ_FOCUS_INSTRUMENTS,
  NASDAQ_UNIVERSE_AS_OF,
  NASDAQ_UNIVERSE_SOURCE,
  getNasdaqFocusUniverse,
  getNasdaqFocusSymbols
};
