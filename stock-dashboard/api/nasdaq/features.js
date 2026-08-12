const { getStoredDailyFeatures, normalizeFeatureDate } = require("../../lib/daily-feature-store");

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
    const result = await getStoredDailyFeatures(req.query?.symbol || "QQQ", req.query?.limit, normalizeFeatureDate(req.query?.date));
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
    sendJson(res, 200, {
      ok: true,
      timezone: "America/New_York",
      instrument: result.instrument,
      count: result.features.length,
      features: result.features
    });
  } catch (error) {
    if (/Invalid feature date|Unsupported market symbol|Instrument is not registered/.test(error?.message || "")) {
      res.setHeader("Cache-Control", "no-store");
      sendJson(res, 400, { ok: false, error: "Invalid feature query" });
      return;
    }
    console.error("Failed to load daily market features", error);
    res.setHeader("Cache-Control", "no-store");
    sendJson(res, 500, { ok: false, error: "Failed to load daily market features" });
  }
};
