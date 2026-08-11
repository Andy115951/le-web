const CLOUD_CONFIG_KEY = "stock-dashboard-supabase-config-v1";
const TABLE_NAME = "watchlist_states";
const HISTORY_TABLE_NAME = "market_event_history";
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
  const current = await client
    .from(TABLE_NAME)
    .select("items,preferences,us_peaks,market_events,updated_at")
    .eq("user_id", userId)
    .limit(1);

  // Keep existing users working until they run the one-column migration.
  const fallback = current.error && /market_events|column/i.test(current.error.message || "")
    ? await client
      .from(TABLE_NAME)
      .select("items,preferences,us_peaks,updated_at")
      .eq("user_id", userId)
      .limit(1)
    : current;
  const { data, error } = fallback;

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
    market_events: Array.isArray(state.marketEvents) ? state.marketEvents : [],
    updated_at: new Date().toISOString()
  };

  const current = await client
    .from(TABLE_NAME)
    .upsert(payload, { onConflict: "user_id" });

  // The fallback avoids breaking the existing watchlist sync before SQL is applied.
  const fallback = current.error && /market_events|column/i.test(current.error.message || "")
    ? await client
      .from(TABLE_NAME)
      .upsert({
        user_id: payload.user_id,
        items: payload.items,
        preferences: payload.preferences,
        us_peaks: payload.us_peaks,
        updated_at: payload.updated_at
      }, { onConflict: "user_id" })
    : current;
  const { error } = fallback;

  return { error: error ? (error.message || "写入云端数据失败") : null };
}

function toHistoryRow(userId, event) {
  const symbol = String(event?.symbol || "").trim().toUpperCase();
  const marketDate = String(event?.date || "").slice(0, 10);
  if (!symbol || !marketDate) return null;
  return {
    user_id: userId,
    market_date: marketDate,
    symbol,
    display_name: String(event?.name || symbol).trim() || symbol,
    change_percent: typeof event?.changePercent === "number" ? event.changePercent : null,
    benchmark_change_percent: typeof event?.benchmarkChangePercent === "number" ? event.benchmarkChangePercent : null,
    driver_type: String(event?.driverType || "unclear"),
    confidence: String(event?.confidence || "low"),
    summary: String(event?.summary || "暂无明确的当日驱动证据。"),
    reasons: Array.isArray(event?.reasons) ? event.reasons : [],
    news: Array.isArray(event?.news) ? event.news : [],
    captured_at: typeof event?.capturedAt === "string" ? event.capturedAt : new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export async function saveMarketEventHistory(client, userId, events) {
  const rows = (events || []).map(function (event) {
    return toHistoryRow(userId, event);
  }).filter(Boolean);
  if (!rows.length) return { error: null };

  const { error } = await client
    .from(HISTORY_TABLE_NAME)
    .upsert(rows, { onConflict: "user_id,market_date,symbol" });
  return { error: error ? (error.message || "写入行情历史失败") : null };
}

export async function loadMarketEventHistory(client, userId, days) {
  const normalizedDays = Math.min(180, Math.max(30, Number(days) || 30));
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - normalizedDays + 1);
  const startDate = start.toISOString().slice(0, 10);
  const { data, error } = await client
    .from(HISTORY_TABLE_NAME)
    .select("market_date,symbol,display_name,change_percent,benchmark_change_percent,driver_type,confidence,summary,reasons,news,captured_at")
    .eq("user_id", userId)
    .gte("market_date", startDate)
    .order("market_date", { ascending: false })
    .order("symbol", { ascending: true })
    .limit(normalizedDays * 16);
  return {
    data: Array.isArray(data) ? data : [],
    error: error ? (error.message || "拉取行情历史失败") : null
  };
}
