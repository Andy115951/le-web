const { getRecentCaptureRuns, sanitizeCaptureRunForOps } = require("../../lib/market-history-capture");
const { isAuthorizedCronRequest, sendJson } = require("../../lib/cron-auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  if (!isAuthorizedCronRequest(req)) {
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }

  try {
    const runs = await getRecentCaptureRuns(req.query?.limit);
    sendJson(res, 200, { ok: true, count: runs.length, runs: runs.map(sanitizeCaptureRunForOps) });
  } catch {
    sendJson(res, 500, { ok: false, error: "Failed to load capture runs" });
  }
};
