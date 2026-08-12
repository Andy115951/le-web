const { getMarketCalendar, getMarketDayDetail } = require("../../lib/market-calendar");

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
    const date = String(req.query?.date || "").trim();
    const result = date ? await getMarketDayDetail(date) : await getMarketCalendar(req.query?.month);
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800");
    sendJson(res, 200, { ok: true, mode: date ? "day" : "month", ...result });
  } catch (error) {
    if (/Invalid calendar/.test(error?.message || "")) {
      res.setHeader("Cache-Control", "no-store");
      sendJson(res, 400, { ok: false, error: error.message });
      return;
    }
    console.error("Failed to load market calendar", error);
    res.setHeader("Cache-Control", "no-store");
    sendJson(res, 500, { ok: false, error: "Failed to load market calendar" });
  }
};
