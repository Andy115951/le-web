const { isPublicRegistrationEnabled } = require("../_lib/config");
const { createPasswordHash, createSession, sanitizeUser } = require("../_lib/auth");
const { json, methodNotAllowed, parseJson } = require("../_lib/http");
const { checkRateLimit } = require("../_lib/rate-limit");
const { getSupabaseAdmin } = require("../_lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  if (!checkRateLimit(req, res, { route: "register", windowMs: 10 * 60 * 1000, max: 10 })) {
    return;
  }

  if (!isPublicRegistrationEnabled()) {
    return json(res, 403, { error: "Registration is currently disabled" });
  }

  try {
    const body = await parseJson(req);
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const displayName = String(body.displayName || "").trim();
    const email = String(body.email || "").trim().toLowerCase() || null;

    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      return json(res, 400, {
        error: "Username must be 3-24 chars and contain only lowercase letters, numbers, or underscores"
      });
    }

    if (password.length < 8) {
      return json(res, 400, { error: "Password must be at least 8 characters" });
    }

    if (displayName.length < 1 || displayName.length > 40) {
      return json(res, 400, { error: "Display name must be between 1 and 40 characters" });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(res, 400, { error: "Email format is invalid" });
    }

    const supabase = getSupabaseAdmin();
    const { data: existingUser, error: existingError } = await supabase
      .from("todo_users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existingUser) {
      return json(res, 409, { error: "Username is already in use" });
    }

    if (email) {
      const { data: existingEmail, error: emailError } = await supabase
        .from("todo_users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (emailError) {
        throw new Error(emailError.message);
      }

      if (existingEmail) {
        return json(res, 409, { error: "Email is already in use" });
      }
    }

    const passwordHash = await createPasswordHash(password);
    const { data: user, error: createError } = await supabase
      .from("todo_users")
      .insert({
        username,
        password_hash: passwordHash,
        display_name: displayName,
        email
      })
      .select("id, username, display_name, email, email_verified, created_at, updated_at")
      .single();

    if (createError) {
      throw new Error(createError.message);
    }

    await createSession(req, res, user.id);

    return json(res, 201, {
      user: sanitizeUser(user)
    });
  } catch (error) {
    return json(res, 500, { error: error.message || "Registration failed" });
  }
};
