import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import {
  ANON_COOKIE,
  SESSION_COOKIE,
  SESSION_DAYS,
  clearCookie,
  getCookie,
  setCookie,
} from "@/lib/cookies";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { PublicUser } from "@/lib/types";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function ensureAnonymousId() {
  let id = await getCookie(ANON_COOKIE);
  if (!id) {
    id = `anon_${nanoid(16)}`;
    await setCookie(ANON_COOKIE, id, 60 * 60 * 24 * 365);
  }
  return id;
}

export async function registerUser(username: string, password: string) {
  const supabase = getSupabaseAdmin();
  const clean = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(clean)) {
    throw new Error("用户名需为 3–24 位字母数字下划线");
  }
  if (password.length < 6) throw new Error("密码至少 6 位");
  const password_hash = await bcrypt.hash(password, 12);
  const { data, error } = await supabase
    .from("tarot_users")
    .insert({ username: clean, password_hash, display_name: clean })
    .select("id, username, display_name")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("用户名已存在");
    throw new Error(error.message);
  }
  await createSession(data.id);
  return { id: data.id, username: data.username, displayName: data.display_name } as PublicUser;
}

export async function loginUser(username: string, password: string) {
  const supabase = getSupabaseAdmin();
  const clean = username.trim().toLowerCase();
  const { data: user, error } = await supabase
    .from("tarot_users")
    .select("id, username, display_name, password_hash")
    .eq("username", clean)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new Error("用户名或密码错误");
  }
  await createSession(user.id);
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
  } as PublicUser;
}

async function createSession(userId: string) {
  const supabase = getSupabaseAdmin();
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  const { error } = await supabase.from("tarot_sessions").insert({
    user_id: userId,
    session_token_hash: hashToken(token),
    expires_at: expires,
  });
  if (error) throw new Error(error.message);
  await setCookie(SESSION_COOKIE, token, SESSION_DAYS * 86400);
}

export async function logoutUser() {
  const supabase = getSupabaseAdmin();
  const token = await getCookie(SESSION_COOKIE);
  if (token) {
    await supabase
      .from("tarot_sessions")
      .delete()
      .eq("session_token_hash", hashToken(token));
  }
  await clearCookie(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const token = await getCookie(SESSION_COOKIE);
  if (!token) return null;
  const supabase = getSupabaseAdmin();
  const { data: session } = await supabase
    .from("tarot_sessions")
    .select("id, user_id, expires_at")
    .eq("session_token_hash", hashToken(token))
    .maybeSingle();
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
    if (session) {
      await supabase.from("tarot_sessions").delete().eq("id", session.id);
    }
    await clearCookie(SESSION_COOKIE);
    return null;
  }
  const { data: user } = await supabase
    .from("tarot_users")
    .select("id, username, display_name")
    .eq("id", session.user_id)
    .maybeSingle();
  if (!user) return null;
  await supabase
    .from("tarot_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", session.id);
  return { id: user.id, username: user.username, displayName: user.display_name };
}

export async function mergeAnonymousReadings(userId: string, anonymousId: string) {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("tarot_readings")
    .update({ user_id: userId, anonymous_id: null, updated_at: new Date().toISOString() })
    .eq("anonymous_id", anonymousId)
    .is("deleted_at", null);
}
