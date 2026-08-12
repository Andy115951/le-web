const { getStoredDailyPrices } = require("../../lib/price-history-store");

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const result = await getStoredDailyPrices(req.query?.symbol || "QQQ", req.query?.limit);
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
    sendJson(res, 200, {
      ok: true,
      instrument: result.instrument,
      count: result.prices.length,
      prices: result.prices
    });
  } catch (error) {
    if (/Unsupported market symbol|Instrument is not registered/.test(error?.message || "")) {
      res.setHeader("Cache-Control", "no-store");
      sendJson(res, 400, { ok: false, error: "Unsupported market symbol" });
      return;
    }
    console.error("Failed to load daily prices", error);
    res.setHeader("Cache-Control", "no-store");
    sendJson(res, 500, { ok: false, error: "Failed to load daily prices" });
  }
};
