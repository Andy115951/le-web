const { runGatewayCompatibilityProbe } = require("../../lib/model-gateway-compatibility");
const { isAuthorizedCronRequest, sendJson } = require("../../lib/cron-auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  if (!isAuthorizedCronRequest(req)) {
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }
  try {
    const result = await runGatewayCompatibilityProbe();
    const accepted = result.status === "accepted";
    const statusCode = accepted ? 200 : (result.status === "rejected" ? 502 : 409);
    sendJson(res, statusCode, { ok: accepted, ...result });
  } catch (_error) {
    sendJson(res, 500, { ok: false, error: "Gateway compatibility check failed" });
  }
};
