const { getGlobalStockDetail } = require("../../lib/global-stock-data");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const symbol = String(req.query?.symbol || req.query?.code || "").trim().toUpperCase();
    if (!symbol) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "symbol is required" }));
      return;
    }

    const detail = await getGlobalStockDetail(symbol);
    res.statusCode = 200;
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ detail }));
  } catch (error) {
    const message = error && error.message ? error.message : "Failed to load global stock detail";
    const statusCode = /仅支持美股/.test(message) ? 400 : 500;
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: message }));
  }
};
