const { getDailyMarketEvents } = require("../../lib/daily-market-events");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const symbols = String(req.query?.symbols || "").split(",");
  if (!symbols.length || !symbols.some(function (symbol) { return String(symbol).trim(); })) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "symbols is required" }));
    return;
  }

  try {
    const result = await getDailyMarketEvents(symbols, {
      benchmarkChange: req.query?.benchmarkChange
    });
    res.statusCode = 200;
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(result));
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: error?.message || "Failed to load market events" }));
  }
};
