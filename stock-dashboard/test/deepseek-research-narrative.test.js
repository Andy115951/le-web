const assert = require("node:assert/strict");
const test = require("node:test");
const { validateResearchNarrative } = require("../lib/research-narrative-contract");
const {
  DEEPSEEK_PROVIDER,
  buildDeepSeekRequest,
  countAttemptsForNewYorkDate,
  getDeepSeekResearchReadiness,
  isDeepSeekResearchConfigured,
  normalizeDeepSeekApiUrl,
  parseDeepSeekResponse,
  runDeepSeekResearchNarrative
} = require("../lib/deepseek-research-narrative");

const packet = {
  contractVersion: "daily-research-packet-v1",
  asOf: { marketDate: "2026-08-11" },
  events: [{
    eventKey: "sec-filing:sample:NVDA",
    sources: [{ url: "https://www.sec.gov/Archives/sample.htm" }]
  }],
  historicalSimilarity: { matches: [{ candidateMarketDate: "2025-03-27" }] }
};

function output() {
  return {
    contractVersion: "research-narrative-v1",
    marketDate: "2026-08-11",
    title: "有据可查的市场复盘",
    recap: "该摘要仅复述已归档事实与历史对照，不构成交易结论。",
    claims: [{
      id: "filing-context",
      text: "该日研究包包含一条可复核的 SEC 文件事件。",
      citations: {
        eventKeys: ["sec-filing:sample:NVDA"],
        sourceUrls: ["https://www.sec.gov/Archives/sample.htm"],
        candidateMarketDates: []
      }
    }],
    uncertainties: ["事件覆盖范围并不代表完整市场信息。"]
  };
}

function configured() {
  return {
    enabled: true,
    apiKey: "not-a-real-secret-key",
    model: "deepseek-chat",
    maxDailyRequests: 1,
    maxOutputTokens: 900
  };
}

test("DeepSeek execution stays disabled until every explicit model setting is present", function () {
  assert.deepEqual(isDeepSeekResearchConfigured({}), { enabled: false, reason: "disabled" });
  assert.deepEqual(isDeepSeekResearchConfigured({ DEEPSEEK_RESEARCH_ENABLED: "true" }), { enabled: false, reason: "missing_api_key" });
  assert.deepEqual(isDeepSeekResearchConfigured({
    DEEPSEEK_RESEARCH_ENABLED: "true",
    DEEPSEEK_API_KEY: "not-a-real-secret-key"
  }), { enabled: false, reason: "missing_model" });
  const active = isDeepSeekResearchConfigured({
    DEEPSEEK_RESEARCH_ENABLED: "true",
    DEEPSEEK_RESEARCH_DATA_APPROVED: "true",
    DEEPSEEK_API_KEY: "not-a-real-secret-key",
    DEEPSEEK_MODEL: "deepseek-chat",
    DEEPSEEK_MAX_DAILY_REQUESTS: "99",
    DEEPSEEK_MAX_OUTPUT_TOKENS: "99999"
  });
  assert.equal(active.enabled, true);
  assert.equal(active.maxDailyRequests, 3);
  assert.equal(active.maxOutputTokens, 1400);
  assert.equal(active.apiUrl, "https://api.deepseek.com/chat/completions");
  assert.equal(isDeepSeekResearchConfigured({
    DEEPSEEK_RESEARCH_ENABLED: "true",
    DEEPSEEK_API_KEY: "not-a-real-secret-key",
    DEEPSEEK_MODEL: "deepseek-chat"
  }).reason, "data_transfer_not_approved");
  assert.equal(isDeepSeekResearchConfigured({
    DEEPSEEK_RESEARCH_ENABLED: "true",
    DEEPSEEK_RESEARCH_DATA_APPROVED: "true",
    DEEPSEEK_API_KEY: "not-a-real-secret-key",
    DEEPSEEK_MODEL: "deepseek-chat",
    DEEPSEEK_API_URL: "http://gateway.example/v1/chat/completions"
  }).reason, "invalid_api_url");
  assert.equal(normalizeDeepSeekApiUrl("https://gateway.example/v1/chat/completions"), "https://gateway.example/v1/chat/completions");
});

test("model readiness distinguishes disabled operation from outbound-data approval", function () {
  const base = { DEEPSEEK_API_KEY: "a".repeat(24), DEEPSEEK_MODEL: "deepseek-v4-flash", DEEPSEEK_API_URL: "https://example.invalid/v1/chat/completions" };
  assert.deepEqual(getDeepSeekResearchReadiness({}), { status: "needs_configuration" });
  assert.deepEqual(getDeepSeekResearchReadiness(base), { status: "disabled" });
  assert.deepEqual(getDeepSeekResearchReadiness({ ...base, DEEPSEEK_RESEARCH_ENABLED: "true" }), { status: "data_approval_required" });
  assert.deepEqual(getDeepSeekResearchReadiness({ ...base, DEEPSEEK_RESEARCH_ENABLED: "true", DEEPSEEK_RESEARCH_DATA_APPROVED: "true" }), { status: "ready" });
  assert.equal(JSON.stringify(getDeepSeekResearchReadiness({ ...base, DEEPSEEK_API_KEY: "secret-key-value" })).includes("secret"), false);
});

test("disabled runs remain traceable to their immutable packet without contacting a model", async function () {
  const result = await runDeepSeekResearchNarrative(packet, { env: {} });
  assert.equal(result.status, "disabled");
  assert.match(result.packetFingerprint, /^[a-f0-9]{64}$/);
});

test("enabled model execution still refuses data transfer without explicit approval", async function () {
  let requested = false;
  const result = await runDeepSeekResearchNarrative(packet, {
    env: {
      DEEPSEEK_RESEARCH_ENABLED: "true",
      DEEPSEEK_API_KEY: "not-a-real-secret-key",
      DEEPSEEK_MODEL: "deepseek-chat"
    },
    requestModel: async function () { requested = true; }
  });
  assert.equal(result.status, "disabled");
  assert.equal(result.reason, "data_transfer_not_approved");
  assert.equal(requested, false);
});

test("DeepSeek request contains only the fixed packet contract and never embeds the API key", function () {
  const body = buildDeepSeekRequest(packet, configured());
  assert.equal(body.response_format.type, "json_object");
  assert.equal(body.messages.length, 2);
  assert.match(body.messages[0].content, /JSON/);
  assert.match(body.messages[0].content, /not investment advice/);
  assert.equal(JSON.stringify(body).includes(configured().apiKey), false);
});

test("DeepSeek execution skips duplicate packets before calling the model", async function () {
  let requested = false;
  const result = await runDeepSeekResearchNarrative(packet, {
    config: configured(),
    getAccepted: async function () { return { id: "already-stored" }; },
    requestModel: async function () { requested = true; }
  });
  assert.equal(result.status, "skipped");
  assert.equal(result.reason, "already_accepted");
  assert.equal(requested, false);
});

test("DeepSeek execution enforces the New York daily request ceiling before model calls", async function () {
  let requested = false;
  const now = new Date("2026-08-12T16:00:00.000Z");
  const result = await runDeepSeekResearchNarrative(packet, {
    now,
    config: configured(),
    getAccepted: async function () { return null; },
    getAttempts: async function () { return [{ created_at: "2026-08-12T15:00:00.000Z" }]; },
    requestModel: async function () { requested = true; }
  });
  assert.equal(result.status, "skipped");
  assert.equal(result.reason, "daily_request_limit");
  assert.equal(requested, false);
  assert.equal(countAttemptsForNewYorkDate([{ created_at: "2026-08-12T15:00:00.000Z" }], now), 1);
});

test("DeepSeek execution validates and audits a JSON response before accepting it", async function () {
  let persisted = null;
  const result = await runDeepSeekResearchNarrative(packet, {
    config: configured(),
    getAccepted: async function () { return null; },
    getAttempts: async function () { return []; },
    requestModel: async function () {
      return { choices: [{ finish_reason: "stop", message: { content: JSON.stringify(output()) } }], usage: { prompt_tokens: 111, completion_tokens: 222 } };
    },
    persistAudit: async function (inputPacket, modelOutput, metadata) {
      persisted = { inputPacket, modelOutput, metadata };
      const validation = validateResearchNarrative(modelOutput, inputPacket);
      return { validation, audit: { id: "audit-1" } };
    }
  });
  assert.equal(result.status, "accepted");
  assert.equal(result.created, true);
  assert.equal(persisted.metadata.provider, DEEPSEEK_PROVIDER);
  assert.equal(persisted.metadata.inputTokens, 111);
  assert.equal(persisted.metadata.outputTokens, 222);
});

test("invalid or truncated DeepSeek output becomes an audited rejection without preserving raw text", async function () {
  let persistedOutput = null;
  const result = await runDeepSeekResearchNarrative(packet, {
    config: configured(),
    getAccepted: async function () { return null; },
    getAttempts: async function () { return []; },
    requestModel: async function () { return { choices: [{ finish_reason: "length", message: { content: '{"secret":"should-not-be-stored"}' } }] }; },
    persistAudit: async function (inputPacket, modelOutput) {
      persistedOutput = modelOutput;
      return { validation: validateResearchNarrative(modelOutput, inputPacket), audit: { id: "audit-2" } };
    }
  });
  assert.equal(result.status, "rejected");
  assert.equal(persistedOutput.modelResponseRejected, true);
  assert.equal(JSON.stringify(persistedOutput).includes("should-not-be-stored"), false);
});

test("DeepSeek response parser accepts clean JSON and rejects incomplete completions", function () {
  assert.deepEqual(parseDeepSeekResponse({ choices: [{ finish_reason: "stop", message: { content: "{\"ok\":true}" } }] }), { ok: true });
  assert.throws(function () {
    parseDeepSeekResponse({ choices: [{ finish_reason: "length", message: { content: "{}" } }] });
  }, /finish cleanly/);
});
