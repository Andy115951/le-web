const assert = require("node:assert/strict");
const test = require("node:test");
const {
  GATEWAY_COMPATIBILITY_MAX_OUTPUT_TOKENS,
  GATEWAY_COMPATIBILITY_PROBE_VERSION,
  buildGatewayCompatibilityRequest,
  getGatewayCompatibilityConfig,
  runGatewayCompatibilityProbe,
  validateGatewayCompatibilityResponse
} = require("../lib/model-gateway-compatibility");

function configuredEnv() {
  return {
    DEEPSEEK_GATEWAY_COMPATIBILITY_ENABLED: "true",
    DEEPSEEK_API_KEY: "a".repeat(24),
    DEEPSEEK_API_URL: "https://gateway.example/v1/chat/completions",
    DEEPSEEK_MODEL: "deepseek-chat"
  };
}

function configured() {
  return {
    enabled: true,
    apiKey: "a".repeat(24),
    apiUrl: "https://gateway.example/v1/chat/completions",
    model: "deepseek-chat"
  };
}

test("gateway probe remains disabled until its dedicated outbound switch is explicitly enabled", function () {
  assert.deepEqual(getGatewayCompatibilityConfig({}), { enabled: false, reason: "disabled" });
  assert.deepEqual(getGatewayCompatibilityConfig({ DEEPSEEK_GATEWAY_COMPATIBILITY_ENABLED: "true" }), { enabled: false, reason: "missing_api_key" });
  assert.equal(getGatewayCompatibilityConfig(configuredEnv()).enabled, true);
});

test("gateway probe request is fixed, JSON-only, bounded, and contains no project research data", function () {
  const body = buildGatewayCompatibilityRequest(configured());
  assert.equal(body.max_tokens, GATEWAY_COMPATIBILITY_MAX_OUTPUT_TOKENS);
  assert.ok(body.max_tokens >= 48);
  assert.equal(body.response_format.type, "json_object");
  assert.equal(body.stream, false);
  assert.deepEqual(body.thinking, { type: "disabled" });
  assert.equal(body.messages.length, 2);
  assert.equal(JSON.stringify(body).includes("researchPacket"), false);
  assert.equal(JSON.stringify(body).includes("marketDate"), false);
  assert.equal(JSON.stringify(body).includes(configured().apiKey), false);
  assert.match(JSON.parse(body.messages[1].content).task, /\{"ok":true,"probeVersion":"model-gateway-compatibility-v1"\}/);
});

test("gateway probe accepts only a clean stop with the exact fixed JSON payload", function () {
  const valid = validateGatewayCompatibilityResponse({
    choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ ok: true, probeVersion: GATEWAY_COMPATIBILITY_PROBE_VERSION }) } }]
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.completionStatus, "stop");
  assert.match(valid.outputFingerprint, /^[a-f0-9]{64}$/);

  const invalid = validateGatewayCompatibilityResponse({
    choices: [{ finish_reason: "length", message: { content: "{}" } }]
  });
  assert.equal(invalid.valid, false);
  assert.deepEqual(invalid.validationErrors, ["completion_not_stop", "unexpected_probe_payload"]);
});

test("gateway probe reserves one audit before outbound access and persists only safe completion metadata", async function () {
  let requestBody = null;
  let completed = null;
  const result = await runGatewayCompatibilityProbe({
    config: configured(),
    supabaseConfig: {},
    reserveAudit: async function (_config, metadata) {
      assert.equal(metadata.provider, "DeepSeek");
      assert.equal(metadata.model, "deepseek-chat");
      return { id: "probe-audit-1" };
    },
    requestModel: async function (body) {
      requestBody = body;
      return { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ ok: true, probeVersion: GATEWAY_COMPATIBILITY_PROBE_VERSION }) } }] };
    },
    completeAudit: async function (_config, id, value) { completed = { id, value }; }
  });
  assert.equal(result.status, "accepted");
  assert.equal(result.auditId, "probe-audit-1");
  assert.equal(result.validationErrorCount, 0);
  assert.equal(requestBody.max_tokens, GATEWAY_COMPATIBILITY_MAX_OUTPUT_TOKENS);
  assert.equal(completed.id, "probe-audit-1");
  assert.equal(completed.value.status, "accepted");
  assert.equal("content" in completed.value, false);
});

test("gateway probe refuses a second attempt before provider access when its audit is already reserved", async function () {
  let requested = false;
  const result = await runGatewayCompatibilityProbe({
    config: configured(),
    supabaseConfig: {},
    reserveAudit: async function () { return null; },
    requestModel: async function () { requested = true; }
  });
  assert.equal(result.status, "skipped");
  assert.equal(result.reason, "already_attempted");
  assert.equal(requested, false);
});

test("gateway probe audits a request failure without preserving provider error text", async function () {
  let completed = null;
  const result = await runGatewayCompatibilityProbe({
    config: configured(),
    supabaseConfig: {},
    reserveAudit: async function () { return { id: "probe-audit-2" }; },
    requestModel: async function () { throw new Error("upstream raw body must not escape"); },
    completeAudit: async function (_config, _id, value) { completed = value; }
  });
  assert.equal(result.status, "rejected");
  assert.equal(result.validationErrorCount, 1);
  assert.deepEqual(completed.validationErrors, ["gateway_request_failed"]);
  assert.equal(JSON.stringify(completed).includes("upstream raw body"), false);
});
