const { getStoredForwardLabels } = require("../../lib/market-label-store");

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
    const result = await getStoredForwardLabels(req.query?.symbol || "QQQ", req.query?.limit);
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
    sendJson(res, 200, {
      ok: true,
      researchOnly: true,
      instrument: result.instrument,
      count: result.labels.length,
      labels: result.labels
    });
  } catch (error) {
    if (/Unsupported market symbol|Instrument is not registered/.test(error?.message || "")) {
      res.setHeader("Cache-Control", "no-store");
      sendJson(res, 400, { ok: false, error: "Unsupported market symbol" });
      return;
    }
    console.error("Failed to load forward labels", error);
    res.setHeader("Cache-Control", "no-store");
    sendJson(res, 500, { ok: false, error: "Failed to load forward labels" });
  }
};
