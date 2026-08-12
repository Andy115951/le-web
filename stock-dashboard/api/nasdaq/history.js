const { getNasdaqMarketHistory } = require("../../lib/market-history-capture");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const history = await getNasdaqMarketHistory(req.query?.days);
    res.statusCode = 200;
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true, count: history.length, history }));
  } catch (error) {
    console.error("Failed to load Nasdaq history", error);
    res.statusCode = 500;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "Failed to load Nasdaq history" }));
  }
};
