const { createSession, sanitizeUser, verifyPassword } = require("../_lib/auth");
const { json, methodNotAllowed, parseJson } = require("../_lib/http");
const { checkRateLimit } = require("../_lib/rate-limit");
const { getSupabaseAdmin } = require("../_lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  if (!checkRateLimit(req, res, { route: "login", windowMs: 10 * 60 * 1000, max: 20 })) {
    return;
  }

  try {
    const body = await parseJson(req);
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!username || !password) {
      return json(res, 400, { error: "Username and password are required" });
    }

    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from("todo_users")
      .select("id, username, password_hash, display_name, email, email_verified, created_at, updated_at")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    const valid = user ? await verifyPassword(password, user.password_hash) : false;
    if (!valid || !user) {
      return json(res, 401, { error: "Invalid username or password" });
    }

    await createSession(req, res, user.id);

    return json(res, 200, {
      user: sanitizeUser(user)
    });
  } catch (error) {
    return json(res, 500, { error: error.message || "Login failed" });
  }
};
