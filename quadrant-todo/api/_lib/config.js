const SESSION_COOKIE_NAME = "quadrant_todo_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

function isPublicRegistrationEnabled() {
  return process.env.PUBLIC_REGISTRATION !== "false";
}

function isSecureRequest(req) {
  const proto = req.headers["x-forwarded-proto"];
  return proto === "https" || process.env.VERCEL === "1";
}

module.exports = {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  SESSION_MAX_AGE_MS,
  isPublicRegistrationEnabled,
  isSecureRequest
};
