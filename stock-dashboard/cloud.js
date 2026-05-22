const CLOUD_CONFIG_KEY = "stock-dashboard-supabase-config-v1";
const TABLE_NAME = "watchlist_states";
const SUPABASE_ESM_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

let createClientLoader = null;

function normalizeConfig(config) {
  return {
    url: String(config?.url || "").trim(),
    anonKey: String(config?.anonKey || "").trim()
  };
}

async function loadCreateClient() {
  if (!createClientLoader) {
    createClientLoader = import(SUPABASE_ESM_URL).then(function (module) {
      return module.createClient;
    });
  }
  return createClientLoader;
}

export function loadCloudConfig() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY) || "null");
  } catch (_) {
    raw = null;
  }
  return normalizeConfig(raw);
}

export function saveCloudConfig(config) {
  const normalized = normalizeConfig(config);
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearCloudConfig() {
  localStorage.removeItem(CLOUD_CONFIG_KEY);
}

export async function createCloudClient(config) {
  const normalized = normalizeConfig(config);
  if (!normalized.url || !normalized.anonKey) {
    return { client: null, error: "请先填写 Supabase URL 和 Anon Key" };
  }

  const createClient = await loadCreateClient();
  const client = createClient(normalized.url, normalized.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  return { client, error: null };
}

export async function getCloudUser(client) {
  if (!client) return { user: null, error: "Cloud client is not ready" };
  const { data, error } = await client.auth.getUser();
  if (error) return { user: null, error: error.message || "获取用户失败" };
  return { user: data.user || null, error: null };
}

export async function sendMagicLink(client, email) {
  const normalizedEmail = String(email || "").trim();
  if (!normalizedEmail) return { error: "请输入登录邮箱" };

  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await client.auth.signInWithOtp({
    email: normalizedEmail,
    options: { emailRedirectTo: redirectTo }
  });
  return { error: error ? (error.message || "发送登录链接失败") : null };
}

export async function signOutCloud(client) {
  if (!client) return { error: null };
  const { error } = await client.auth.signOut();
  return { error: error ? (error.message || "退出失败") : null };
}

export function onCloudAuthChange(client, callback) {
  if (!client) return function () {};
  const result = client.auth.onAuthStateChange(function (_event, session) {
    callback(session?.user || null);
  });
  return function () {
    if (result?.data?.subscription?.unsubscribe) {
      result.data.subscription.unsubscribe();
    }
  };
}

export async function loadRemoteState(client, userId) {
  const { data, error } = await client
    .from(TABLE_NAME)
    .select("items,preferences,us_peaks,updated_at")
    .eq("user_id", userId)
    .limit(1);

  if (error) {
    return { data: null, error: error.message || "拉取云端数据失败" };
  }

  const row = Array.isArray(data) && data.length ? data[0] : null;
  return { data: row, error: null };
}

export async function saveRemoteState(client, userId, state) {
  const payload = {
    user_id: userId,
    items: Array.isArray(state.items) ? state.items : [],
    preferences: state.preferences && typeof state.preferences === "object" ? state.preferences : {},
    us_peaks: state.usPeaks && typeof state.usPeaks === "object" ? state.usPeaks : {},
    updated_at: new Date().toISOString()
  };

  const { error } = await client
    .from(TABLE_NAME)
    .upsert(payload, { onConflict: "user_id" });

  return { error: error ? (error.message || "写入云端数据失败") : null };
}
