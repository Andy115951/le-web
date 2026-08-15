const crypto = require("crypto");
const {
  DEEPSEEK_PROVIDER,
  getDeepSeekGatewayConfig,
  requestDeepSeek
} = require("./deepseek-research-narrative");
const { getSupabaseConfig, requestSupabase } = require("./supabase-server");

const GATEWAY_COMPATIBILITY_PROBE_VERSION = "model-gateway-compatibility-v1";
const GATEWAY_COMPATIBILITY_MAX_OUTPUT_TOKENS = 48;

function isEnabledFlag(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function safeCompletionStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return /^[a-z0-9_-]{1,40}$/.test(status) ? status : null;
}

function fingerprintText(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function buildGatewayCompatibilityRequest(config) {
  return {
    model: config.model,
    temperature: 0,
    max_tokens: GATEWAY_COMPATIBILITY_MAX_OUTPUT_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Return exactly one JSON object and no markdown." },
      { role: "user", content: JSON.stringify({ probeVersion: GATEWAY_COMPATIBILITY_PROBE_VERSION, task: 'Return exactly {"ok":true,"probeVersion":"model-gateway-compatibility-v1"}. This is a gateway compatibility probe and contains no project data.' }) }
    ]
  };
}

function validateGatewayCompatibilityResponse(payload) {
  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
  const completionStatus = safeCompletionStatus(choice?.finish_reason);
  const content = typeof choice?.message?.content === "string" ? choice.message.content.trim() : "";
  const validationErrors = [];
  if (completionStatus !== "stop") validationErrors.push("completion_not_stop");
  if (!content) validationErrors.push("missing_json_content");
  let output = null;
  if (content) {
    try {
      output = JSON.parse(content);
    } catch (_error) {
      validationErrors.push("invalid_json_content");
    }
  }
  if (!output || output.ok !== true || output.probeVersion !== GATEWAY_COMPATIBILITY_PROBE_VERSION) {
    validationErrors.push("unexpected_probe_payload");
  }
  return {
    valid: validationErrors.length === 0,
    completionStatus,
    outputFingerprint: content ? fingerprintText(content) : null,
    validationErrors
  };
}

function getGatewayCompatibilityConfig(env = process.env) {
  if (!isEnabledFlag(env.DEEPSEEK_GATEWAY_COMPATIBILITY_ENABLED)) {
    return { enabled: false, reason: "disabled" };
  }
  const gateway = getDeepSeekGatewayConfig(env);
  if (!gateway.configured) return { enabled: false, reason: gateway.reason };
  return { enabled: true, ...gateway };
}

async function reserveGatewayCompatibilityAudit(config, metadata, requestImpl = requestSupabase) {
  const rows = await requestImpl(config, "/rest/v1/model_gateway_compatibility_audits?on_conflict=probe_version,provider,model", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: {
      probe_version: GATEWAY_COMPATIBILITY_PROBE_VERSION,
      provider: metadata.provider,
      model: metadata.model,
      status: "pending",
      requested_at: metadata.requestedAt
    }
  });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function completeGatewayCompatibilityAudit(config, auditId, result, requestImpl = requestSupabase) {
  await requestImpl(config, "/rest/v1/model_gateway_compatibility_audits?id=eq." + encodeURIComponent(auditId), {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: {
      status: result.status,
      completion_status: result.completionStatus,
      output_fingerprint: result.outputFingerprint,
      validation_errors: result.validationErrors,
      latency_ms: result.latencyMs,
      completed_at: result.completedAt
    }
  });
}

function safeProbeResult(result) {
  return {
    status: result.status,
    reason: result.reason || null,
    created: Boolean(result.created),
    probeVersion: GATEWAY_COMPATIBILITY_PROBE_VERSION,
    provider: DEEPSEEK_PROVIDER,
    model: result.model || null,
    completionStatus: result.completionStatus || null,
    auditId: result.auditId || null,
    validationErrorCount: Array.isArray(result.validationErrors) ? result.validationErrors.length : 0
  };
}

async function runGatewayCompatibilityProbe(options = {}) {
  const env = options.env || process.env;
  const config = options.config || getGatewayCompatibilityConfig(env);
  if (!config.enabled) return safeProbeResult({ status: "skipped", reason: config.reason, model: config.model });

  const now = options.now instanceof Date ? options.now : new Date();
  const requestDb = options.requestSupabase || requestSupabase;
  const supabaseConfig = options.supabaseConfig || getSupabaseConfig();
  const audit = await (options.reserveAudit || reserveGatewayCompatibilityAudit)(supabaseConfig, {
    provider: DEEPSEEK_PROVIDER,
    model: config.model,
    requestedAt: now.toISOString()
  }, requestDb);
  if (!audit?.id) return safeProbeResult({ status: "skipped", reason: "already_attempted", model: config.model });

  const startedAt = Date.now();
  let validation;
  try {
    const payload = await (options.requestModel || requestDeepSeek)(buildGatewayCompatibilityRequest(config), config, options.fetchImpl);
    validation = validateGatewayCompatibilityResponse(payload);
  } catch (_error) {
    validation = { valid: false, completionStatus: null, outputFingerprint: null, validationErrors: ["gateway_request_failed"] };
  }
  const result = {
    status: validation.valid ? "accepted" : "rejected",
    completionStatus: validation.completionStatus,
    outputFingerprint: validation.outputFingerprint,
    validationErrors: validation.validationErrors,
    latencyMs: Math.max(0, Date.now() - startedAt),
    completedAt: new Date().toISOString()
  };
  await (options.completeAudit || completeGatewayCompatibilityAudit)(supabaseConfig, audit.id, result, requestDb);
  return safeProbeResult({ ...result, created: true, model: config.model, auditId: audit.id });
}

module.exports = {
  GATEWAY_COMPATIBILITY_MAX_OUTPUT_TOKENS,
  GATEWAY_COMPATIBILITY_PROBE_VERSION,
  buildGatewayCompatibilityRequest,
  completeGatewayCompatibilityAudit,
  getGatewayCompatibilityConfig,
  isEnabledFlag,
  reserveGatewayCompatibilityAudit,
  runGatewayCompatibilityProbe,
  safeCompletionStatus,
  validateGatewayCompatibilityResponse
};
