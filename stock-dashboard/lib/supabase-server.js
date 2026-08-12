function getSupabaseConfig() {
  const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const secretKey = String(process.env.SUPABASE_SECRET_KEY || "").trim();
  if (!url || !secretKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY");
  }
  return { url, secretKey };
}

async function requestSupabase(config, path, options) {
  const response = await fetch(config.url + path, {
    method: options?.method || "GET",
    headers: {
      // New sb_secret_ keys are opaque API keys, not JWT bearer tokens.
      apikey: config.secretKey,
      "Content-Type": "application/json",
      ...(options?.headers || {})
    },
    body: options?.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  if (!response.ok) throw new Error("Supabase " + response.status + ": " + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}

module.exports = { getSupabaseConfig, requestSupabase };
