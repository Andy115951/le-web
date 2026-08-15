const { captureMarketHistory, sanitizeCaptureResultForOps } = require("../../lib/market-history-capture");
const { isAuthorizedCronRequest, sendJson } = require("../../lib/cron-auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  if (!isAuthorizedCronRequest(req)) {
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }

  try {
    const result = await captureMarketHistory({
      trigger: req.method === "POST" ? "manual" : "cron"
    });
    const ok = result.status !== "failed";
    sendJson(res, ok ? 200 : 502, { ok, ...sanitizeCaptureResultForOps(result) });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      runId: error?.runId || null,
      error: "History capture failed"
    });
  }
};
