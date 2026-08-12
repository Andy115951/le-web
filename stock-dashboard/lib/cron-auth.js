const crypto = require("crypto");

function isAuthorizedCronRequest(req) {
  const expected = String(process.env.CRON_SECRET || "");
  const actual = String(req?.headers?.authorization || "");
  const expectedHeader = "Bearer " + expected;

  if (!expected || actual.length !== expectedHeader.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expectedHeader));
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

module.exports = { isAuthorizedCronRequest, sendJson };

