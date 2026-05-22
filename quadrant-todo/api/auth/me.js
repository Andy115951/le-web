const { getSession } = require("../_lib/auth");
const { json, methodNotAllowed } = require("../_lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  try {
    const auth = await getSession(req, res);
    if (!auth) {
      return json(res, 401, { user: null });
    }
    return json(res, 200, { user: auth.user });
  } catch (error) {
    return json(res, 500, { error: error.message || "Failed to fetch session" });
  }
};
