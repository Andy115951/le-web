const { marketDate } = require("./daily-market-events");
const { buildResearchNarrativeInstructions, researchPacketFingerprint } = require("./research-narrative-contract");
const {
  getAcceptedResearchNarrative,
  getRecentProviderNarrativeAttempts,
  persistResearchNarrativeAudit
} = require("./research-narrative-audit");

const DEEPSEEK_PROVIDER = "DeepSeek";
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const MAX_DAILY_REQUESTS_HARD_LIMIT = 3;
const MAX_OUTPUT_TOKENS_HARD_LIMIT = 1400;
const REQUEST_TIMEOUT_MS = 25_000;

function boundedPositiveInteger(value, fallback, maximum) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? Math.min(number, maximum) : fallback;
}

function safeErrorMessage(error) {
  return String(error?.message || error || "Model request failed").replace(/[\r\n]+/g, " ").slice(0, 180);
}

function isDeepSeekResearchConfigured(env = process.env) {
  const enabled = String(env.DEEPSEEK_RESEARCH_ENABLED || "").trim().toLowerCase() === "true";
  const apiKey = String(env.DEEPSEEK_API_KEY || "").trim();
  const model = String(env.DEEPSEEK_MODEL || "").trim();
  if (!enabled) return { enabled: false, reason: "disabled" };
  if (apiKey.length < 16) return { enabled: false, reason: "missing_api_key" };
  if (!model) return { enabled: false, reason: "missing_model" };
  return {
    enabled: true,
    apiKey,
    model: model.slice(0, 100),
    maxDailyRequests: boundedPositiveInteger(env.DEEPSEEK_MAX_DAILY_REQUESTS, 1, MAX_DAILY_REQUESTS_HARD_LIMIT),
    maxOutputTokens: boundedPositiveInteger(env.DEEPSEEK_MAX_OUTPUT_TOKENS, 900, MAX_OUTPUT_TOKENS_HARD_LIMIT)
  };
}

function buildDeepSeekRequest(packet, config) {
  const instructions = buildResearchNarrativeInstructions(packet);
  return {
    model: config.model,
    temperature: 0.1,
    max_tokens: config.maxOutputTokens,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "Return exactly one JSON object and no markdown.",
          "You are writing an evidence-grounded market recap, not investment advice.",
          "Use only the supplied research packet and permitted citations.",
          "Never provide buy, sell, target-price, allocation, or probability-forecast language.",
          "Every factual claim must use the required JSON citation fields."
        ].join(" ")
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Produce JSON matching this contract.",
          narrativeInstructions: instructions,
          researchPacket: packet
        })
      }
    ]
  };
}

function parseDeepSeekResponse(payload) {
  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
  const content = typeof choice?.message?.content === "string" ? choice.message.content.trim() : "";
  if (choice?.finish_reason !== "stop") throw new Error("Model response did not finish cleanly");
  if (!content) throw new Error("Model returned empty JSON content");
  try {
    return JSON.parse(content);
  } catch (_error) {
    throw new Error("Model returned invalid JSON");
  }
}

function countAttemptsForNewYorkDate(attempts, now) {
  const date = marketDate(now);
  return (Array.isArray(attempts) ? attempts : []).filter(function (attempt) {
    return attempt?.created_at && marketDate(new Date(attempt.created_at)) === date;
  }).length;
}

async function requestDeepSeek(body, config, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + config.apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) throw new Error("DeepSeek request failed with status " + response.status);
    try {
      return JSON.parse(text);
    } catch (_error) {
      throw new Error("DeepSeek returned an invalid response body");
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function runDeepSeekResearchNarrative(packet, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  if (!packet?.asOf?.marketDate || !packet?.contractVersion) {
    return { status: "skipped", reason: "missing_research_packet", created: false };
  }

  const packetFingerprint = researchPacketFingerprint(packet);
  const config = options.config || isDeepSeekResearchConfigured(options.env || process.env);
  if (!config.enabled) return { status: "disabled", reason: config.reason, created: false, packetFingerprint };
  const existing = await (options.getAccepted || getAcceptedResearchNarrative)({
    packetFingerprint,
    provider: DEEPSEEK_PROVIDER,
    model: config.model
  }, options.supabaseConfig, options.requestSupabase);
  if (existing) {
    return { status: "skipped", reason: "already_accepted", created: false, audit: existing, packetFingerprint };
  }

  const attempts = await (options.getAttempts || getRecentProviderNarrativeAttempts)({ provider: DEEPSEEK_PROVIDER }, options.supabaseConfig, options.requestSupabase);
  if (countAttemptsForNewYorkDate(attempts, now) >= config.maxDailyRequests) {
    return { status: "skipped", reason: "daily_request_limit", created: false, packetFingerprint };
  }

  const startedAt = Date.now();
  let output = {};
  let providerError = null;
  let usage = {};
  try {
    const payload = await (options.requestModel || requestDeepSeek)(buildDeepSeekRequest(packet, config), config, options.fetchImpl);
    output = parseDeepSeekResponse(payload);
    usage = payload?.usage && typeof payload.usage === "object" ? payload.usage : {};
  } catch (error) {
    providerError = safeErrorMessage(error);
    output = { modelResponseRejected: true, error: providerError };
  }

  const persisted = await (options.persistAudit || persistResearchNarrativeAudit)(packet, output, {
    provider: DEEPSEEK_PROVIDER,
    model: config.model,
    runId: options.runId || null,
    generatedAt: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    temperature: 0.1
  }, options.supabaseConfig, options.requestSupabase);

  return {
    status: persisted.validation.valid && !providerError ? "accepted" : "rejected",
    reason: providerError || (persisted.validation.valid ? null : "contract_validation_failed"),
    created: Boolean(persisted.audit),
    packetFingerprint,
    audit: persisted.audit,
    validationErrors: persisted.validation.errors
  };
}

module.exports = {
  DEEPSEEK_API_URL,
  DEEPSEEK_PROVIDER,
  MAX_DAILY_REQUESTS_HARD_LIMIT,
  MAX_OUTPUT_TOKENS_HARD_LIMIT,
  buildDeepSeekRequest,
  countAttemptsForNewYorkDate,
  isDeepSeekResearchConfigured,
  parseDeepSeekResponse,
  runDeepSeekResearchNarrative
};
