const { marketDate } = require("./daily-market-events");
const { RESEARCH_NARRATIVE_VERSION, buildResearchNarrativeInstructions, researchPacketFingerprint } = require("./research-narrative-contract");
const {
  getAcceptedResearchNarrative,
  getRecentProviderNarrativeAttempts,
  persistResearchNarrativeAudit
} = require("./research-narrative-audit");

const DEEPSEEK_PROVIDER = "DeepSeek";
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const MAX_DAILY_REQUESTS_HARD_LIMIT = 3;
const MAX_OUTPUT_TOKENS_HARD_LIMIT = 1400;
const REQUEST_TIMEOUT_MS_DEFAULT = 50_000;
const REQUEST_TIMEOUT_MS_HARD_MAX = 90_000;
const JSON_MODE_THINKING = { type: "disabled" };

function applyJsonModeRequestDefaults(body) {
  return {
    ...body,
    stream: false,
    response_format: body?.response_format || { type: "json_object" },
    thinking: JSON_MODE_THINKING
  };
}

function boundedPositiveInteger(value, fallback, maximum) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? Math.min(number, maximum) : fallback;
}

function normalizeDeepSeekApiUrl(value) {
  const candidate = String(value || DEEPSEEK_API_URL).trim();
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch (_error) {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || !parsed.hostname) return null;
  return parsed.toString();
}

function isEnabledFlag(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function normalizeAllowedPacketFingerprint(value) {
  const fingerprint = String(value || "").trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(fingerprint) ? fingerprint : null;
}

function getDeepSeekGatewayConfig(env = process.env) {
  const apiKey = String(env.DEEPSEEK_API_KEY || "").trim();
  const model = String(env.DEEPSEEK_MODEL || "").trim();
  const apiUrl = normalizeDeepSeekApiUrl(env.DEEPSEEK_API_URL);
  if (apiKey.length < 16) return { configured: false, reason: "missing_api_key" };
  if (!model) return { configured: false, reason: "missing_model" };
  if (!apiUrl) return { configured: false, reason: "invalid_api_url" };
  return { configured: true, apiKey, model: model.slice(0, 100), apiUrl };
}

function getDeepSeekResearchReadiness(env = process.env) {
  const gateway = getDeepSeekGatewayConfig(env);
  if (!gateway.configured) return { status: "needs_configuration" };
  if (!isEnabledFlag(env.DEEPSEEK_RESEARCH_ENABLED)) return { status: "disabled" };
  if (!isEnabledFlag(env.DEEPSEEK_RESEARCH_DATA_APPROVED)) return { status: "data_approval_required" };
  return { status: "ready" };
}

function safeErrorMessage(error) {
  return String(error?.message || error || "Model request failed").replace(/[\r\n]+/g, " ").slice(0, 180);
}

function classifyDeepSeekFailure(error) {
  const message = String(error?.message || error || "");
  if (/did not finish cleanly/i.test(message)) return "model_response_incomplete";
  if (/empty JSON content/i.test(message)) return "model_response_empty";
  if (/invalid JSON/i.test(message)) return "model_response_invalid_json";
  if (/request failed with status/i.test(message)) return "gateway_http_error";
  return "gateway_request_failed";
}

function isDeepSeekResearchConfigured(env = process.env) {
  const enabled = isEnabledFlag(env.DEEPSEEK_RESEARCH_ENABLED);
  const dataApproved = isEnabledFlag(env.DEEPSEEK_RESEARCH_DATA_APPROVED);
  if (!enabled) return { enabled: false, reason: "disabled" };
  const gateway = getDeepSeekGatewayConfig(env);
  if (!gateway.configured) return { enabled: false, reason: gateway.reason };
  if (!dataApproved) return { enabled: false, reason: "data_transfer_not_approved" };
  return {
    enabled: true,
    apiKey: gateway.apiKey,
    model: gateway.model,
    apiUrl: gateway.apiUrl,
    maxDailyRequests: boundedPositiveInteger(env.DEEPSEEK_MAX_DAILY_REQUESTS, 1, MAX_DAILY_REQUESTS_HARD_LIMIT),
    maxOutputTokens: boundedPositiveInteger(env.DEEPSEEK_MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS_HARD_LIMIT, MAX_OUTPUT_TOKENS_HARD_LIMIT),
    requestTimeoutMs: boundedPositiveInteger(env.DEEPSEEK_REQUEST_TIMEOUT_MS, REQUEST_TIMEOUT_MS_DEFAULT, REQUEST_TIMEOUT_MS_HARD_MAX)
  };
}

function buildDeepSeekRequest(packet, config) {
  const instructions = buildResearchNarrativeInstructions(packet);
  return applyJsonModeRequestDefaults({
    model: config.model,
    temperature: 0.1,
    max_tokens: config.maxOutputTokens,
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
  });
}

function stripMarkdownCodeFence(text) {
  // Some models wrap JSON output in ```json ... ``` despite instructions.
  // Strip a leading ```[json] fence and trailing ``` so JSON.parse can succeed.
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function parseDeepSeekResponse(payload) {
  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
  const rawContent = typeof choice?.message?.content === "string" ? choice.message.content.trim() : "";
  if (choice?.finish_reason !== "stop") throw new Error("Model response did not finish cleanly");
  if (!rawContent) throw new Error("Model returned empty JSON content");
  const content = stripMarkdownCodeFence(rawContent);
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
  const timeoutMs = (config && config.requestTimeoutMs) || REQUEST_TIMEOUT_MS_DEFAULT;
  const timeout = setTimeout(function () { controller.abort(); }, timeoutMs);
  try {
    const response = await fetchImpl(config.apiUrl || DEEPSEEK_API_URL, {
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
  const allowedPacketFingerprint = normalizeAllowedPacketFingerprint((options.env || process.env).DEEPSEEK_ALLOWED_PACKET_FINGERPRINT);
  if (allowedPacketFingerprint && packetFingerprint !== allowedPacketFingerprint) {
    return { status: "skipped", reason: "packet_not_approved", created: false, packetFingerprint };
  }
  const existing = await (options.getAccepted || getAcceptedResearchNarrative)({
    packetFingerprint,
    provider: DEEPSEEK_PROVIDER,
    model: config.model
  }, options.supabaseConfig, options.requestSupabase);
  if (existing) {
    return { status: "skipped", reason: "already_accepted", created: false, audit: existing, packetFingerprint };
  }

  const attempts = await (options.getAttempts || getRecentProviderNarrativeAttempts)({ provider: DEEPSEEK_PROVIDER }, options.supabaseConfig, options.requestSupabase);
  if (isEnabledFlag((options.env || process.env).DEEPSEEK_ONE_TIME_VALIDATION)) {
    const consumed = attempts.some(function (attempt) {
      return String(attempt.packet_fingerprint || "").toLowerCase() === packetFingerprint;
    });
    if (consumed) {
      return { status: "skipped", reason: "one_time_validation_consumed", created: false, packetFingerprint };
    }
  }
  if (countAttemptsForNewYorkDate(attempts, now) >= config.maxDailyRequests) {
    return { status: "skipped", reason: "daily_request_limit", created: false, packetFingerprint };
  }

  const startedAt = Date.now();
  let output = {};
  let providerError = null;
  let providerFailureCode = null;
  let usage = {};
  try {
    const payload = await (options.requestModel || requestDeepSeek)(buildDeepSeekRequest(packet, config), config, options.fetchImpl);
    output = parseDeepSeekResponse(payload);
    // Inject contractVersion — the model reliably omits it despite instructions.
    if (output && typeof output === "object" && !output.contractVersion) {
      output.contractVersion = RESEARCH_NARRATIVE_VERSION;
    }
    usage = payload?.usage && typeof payload.usage === "object" ? payload.usage : {};
  } catch (error) {
    providerError = safeErrorMessage(error);
    providerFailureCode = classifyDeepSeekFailure(error);
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
    temperature: 0.1,
    failureCode: providerFailureCode
  }, options.supabaseConfig, options.requestSupabase);

  return {
    status: persisted.validation.valid && !providerError ? "accepted" : "rejected",
    reason: providerError || (persisted.validation.valid ? null : "contract_validation_failed"),
    failureCode: providerFailureCode || (persisted.validation.valid ? null : "narrative_contract_invalid"),
    created: Boolean(persisted.audit),
    packetFingerprint,
    audit: persisted.audit,
    validationErrors: persisted.validation.errors
  };
}

module.exports = {
  DEEPSEEK_API_URL,
  DEEPSEEK_PROVIDER,
  JSON_MODE_THINKING,
  MAX_DAILY_REQUESTS_HARD_LIMIT,
  MAX_OUTPUT_TOKENS_HARD_LIMIT,
  applyJsonModeRequestDefaults,
  buildDeepSeekRequest,
  countAttemptsForNewYorkDate,
  classifyDeepSeekFailure,
  getDeepSeekResearchReadiness,
  getDeepSeekGatewayConfig,
  isDeepSeekResearchConfigured,
  normalizeDeepSeekApiUrl,
  normalizeAllowedPacketFingerprint,
  parseDeepSeekResponse,
  requestDeepSeek,
  runDeepSeekResearchNarrative
};
