const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  SESSION_MAX_AGE_SECONDS,
  isSecureRequest
} = require("./config");
const { getClientIp, json, parseCookies, serializeCookie } = require("./http");
const { getSupabaseAdmin } = require("./supabase");

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    email: user.email,
    emailVerified: Boolean(user.email_verified),
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };
}

function setSessionCookie(req, res, token) {
  res.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isSecureRequest(req),
      sameSite: "Lax",
      maxAge: SESSION_MAX_AGE_SECONDS,
      expires: new Date(Date.now() + SESSION_MAX_AGE_MS),
      path: "/"
    })
  );
}

function clearSessionCookie(req, res) {
  res.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: isSecureRequest(req),
      sameSite: "Lax",
      maxAge: 0,
      expires: new Date(0),
      path: "/"
    })
  );
}

async function createPasswordHash(password) {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

async function createSession(req, res, userId) {
  const supabase = getSupabaseAdmin();
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_MAX_AGE_MS).toISOString();

  const { error } = await supabase.from("todo_sessions").insert({
    user_id: userId,
    session_token_hash: tokenHash,
    expires_at: expiresAt,
    last_seen_at: new Date(now).toISOString(),
    user_agent: req.headers["user-agent"] || "",
    ip: getClientIp(req)
  });

  if (error) {
    throw new Error(error.message);
  }

  setSessionCookie(req, res, token);
}

async function destroySession(req, res) {
  const supabase = getSupabaseAdmin();
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];

  if (token) {
    const tokenHash = hashSessionToken(token);
    await supabase.from("todo_sessions").delete().eq("session_token_hash", tokenHash);
  }

  clearSessionCookie(req, res);
}

async function getSession(req, res) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const tokenHash = hashSessionToken(token);
  const { data: session, error: sessionError } = await supabase
    .from("todo_sessions")
    .select("id, user_id, expires_at")
    .eq("session_token_hash", tokenHash)
    .maybeSingle();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (!session) {
    clearSessionCookie(req, res);
    return null;
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await supabase.from("todo_sessions").delete().eq("id", session.id);
    clearSessionCookie(req, res);
    return null;
  }

  const { data: user, error: userError } = await supabase
    .from("todo_users")
    .select("id, username, display_name, email, email_verified, created_at, updated_at")
    .eq("id", session.user_id)
    .maybeSingle();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!user) {
    await supabase.from("todo_sessions").delete().eq("id", session.id);
    clearSessionCookie(req, res);
    return null;
  }

  await supabase
    .from("todo_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", session.id);

  return {
    session,
    user: sanitizeUser(user)
  };
}

async function requireUser(req, res) {
  const auth = await getSession(req, res);
  if (!auth) {
    json(res, 401, { error: "Authentication required" });
    return null;
  }
  return auth;
}

module.exports = {
  createPasswordHash,
  createSession,
  destroySession,
  getSession,
  hashSessionToken,
  requireUser,
  sanitizeUser,
  verifyPassword
};
