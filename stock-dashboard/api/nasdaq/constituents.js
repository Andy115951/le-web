const { getNdxSnapshot } = require("../../lib/ndx-snapshots");

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
    const snapshot = await getNdxSnapshot(req.query?.asOf);
    if (!snapshot) {
      sendJson(res, 404, { ok: false, error: "No NDX snapshot available for the requested date" });
      return;
    }
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    sendJson(res, 200, { ok: true, snapshot });
  } catch (error) {
    if (/Invalid as-of date/.test(error?.message || "")) {
      res.setHeader("Cache-Control", "no-store");
      sendJson(res, 400, { ok: false, error: "Invalid asOf date; expected YYYY-MM-DD" });
      return;
    }
    console.error("Failed to load NDX constituents", error);
    res.setHeader("Cache-Control", "no-store");
    sendJson(res, 500, { ok: false, error: "Failed to load NDX constituents" });
  }
};
