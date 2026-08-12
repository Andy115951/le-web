const { getUnifiedMarketEvents } = require("../../lib/unified-market-events");

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
    const events = await getUnifiedMarketEvents(req.query?.days);
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
    sendJson(res, 200, { ok: true, count: events.length, events });
  } catch (error) {
    console.error("Failed to load unified market events", error);
    res.setHeader("Cache-Control", "no-store");
    sendJson(res, 500, { ok: false, error: "Failed to load unified market events" });
  }
};
