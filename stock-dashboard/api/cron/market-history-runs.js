const { getRecentCaptureRuns, normalizeCaptureRunId, sanitizeCaptureRunForOps } = require("../../lib/market-history-capture");
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

  const requestedRunId = req.query?.runId;
  if (requestedRunId && !normalizeCaptureRunId(requestedRunId)) {
    sendJson(res, 400, { error: "Invalid run id" });
    return;
  }

  try {
    const runs = await getRecentCaptureRuns({ limit: req.query?.limit, runId: requestedRunId });
    sendJson(res, 200, { ok: true, count: runs.length, runs: runs.map(sanitizeCaptureRunForOps) });
  } catch {
    sendJson(res, 500, { ok: false, error: "Failed to load capture runs" });
  }
};
