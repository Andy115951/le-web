const { destroySession } = require("../_lib/auth");
const { json, methodNotAllowed } = require("../_lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    await destroySession(req, res);
    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, 500, { error: error.message || "Logout failed" });
  }
};
