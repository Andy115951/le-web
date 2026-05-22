const { isPublicRegistrationEnabled } = require("./_lib/config");
const { json, methodNotAllowed } = require("./_lib/http");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  return json(res, 200, {
    appName: "Quadrant Todo",
    publicRegistration: isPublicRegistrationEnabled()
  });
};
