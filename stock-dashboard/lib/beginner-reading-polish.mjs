import { createRequire } from "node:module";
import {
  BEGINNER_READING_VERSION,
  assertSafeBeginnerReadingText,
  buildBeginnerReading,
  containsBannedBeginnerReading
} from "./beginner-reading.mjs";

const require = createRequire(import.meta.url);
const {
  applyJsonModeRequestDefaults,
  getDeepSeekGatewayConfig,
  parseDeepSeekResponse,
  requestDeepSeek
} = require("./deepseek-research-narrative.js");
const { fingerprint } = require("./research-narrative-contract.js");
const { getSupabaseConfig, requestSupabase } = require("./supabase-server.js");

export const BEGINNER_READING_POLISH_VERSION = "beginner-reading-interpret-v2";
export const BEGINNER_READING_INTERPRET_VERSION = BEGINNER_READING_POLISH_VERSION;
const MIN_INTERPRET_PARAGRAPHS = 2;
const MAX_INTERPRET_PARAGRAPHS = 3;
const MAX_INTERPRET_PARAGRAPH_CHARS = 280;
const META_LAYOUT_PATTERN = /第[一二三四五]格|五个小格子|五个格子|五个小格|把市场拆成/;
const DISCIPLINE_LABELS = ["回撤纪律", "目标已到", "临近目标", "相对 QQQ 偏弱", "当日波动较大"];
const TICKER_ALLOWLIST_EXTRA = new Set(["FY", "IR", "ETF"]);
const POLISH_PROVIDER = "DeepSeek";
const MAX_OUTPUT_TOKENS_HARD_LIMIT = 1400;
const DRIVER_TYPES = new Set(["market", "company", "mixed", "unclear", "insufficient_evidence"]);
const OBSERVATION_KINDS = new Set(["drawdown_rule", "target_hit", "target_near", "relative_weakness", "daily_drop"]);

function isEnabledFlag(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function boundedPositiveInteger(value, fallback, maximum) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? Math.min(number, maximum) : fallback;
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function isBeginnerReadingPolishConfigured(env = process.env) {
  if (!isEnabledFlag(env.DEEPSEEK_BEGINNER_READING_ENABLED)) {
    return { enabled: false, reason: "disabled" };
  }
  const gateway = getDeepSeekGatewayConfig(env);
  if (!gateway.configured) return { enabled: false, reason: gateway.reason };
  return {
    enabled: true,
    apiKey: gateway.apiKey,
    model: gateway.model,
    apiUrl: gateway.apiUrl,
    maxOutputTokens: boundedPositiveInteger(env.DEEPSEEK_MAX_OUTPUT_TOKENS, 900, MAX_OUTPUT_TOKENS_HARD_LIMIT)
  };
}

function sanitizeSymbol(value) {
  const symbol = String(value || "").trim().toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol) ? symbol : null;
}

export function sanitizeBeginnerReadingFacts(input) {
  const source = input && typeof input === "object" ? input : {};
  const observations = (Array.isArray(source.observations) ? source.observations : []).map(function (item) {
    const symbol = sanitizeSymbol(item?.symbol);
    const kind = OBSERVATION_KINDS.has(item?.kind) ? item.kind : null;
    if (!symbol || !kind) return null;
    const aligned = item?.alignedWithQqq;
    return {
      symbol,
      kind,
      alignedWithQqq: aligned === true ? true : (aligned === false ? false : null)
    };
  }).filter(Boolean).slice(0, 2);
  return {
    marketDate: String(source.marketDate || "").trim(),
    mode: source.mode === "close" ? "close" : "intraday",
    qqqChangePercent: finiteNumber(source.qqqChangePercent),
    magsChangePercent: finiteNumber(source.magsChangePercent),
    volatilityLevel: typeof source.volatilityLevel === "string" ? source.volatilityLevel.trim().slice(0, 20) || null : null,
    components: (Array.isArray(source.components) ? source.components : []).map(function (item) {
      const symbol = sanitizeSymbol(item?.symbol);
      const relativeToQqq = finiteNumber(item?.relativeToQqq);
      const changePercent = finiteNumber(item?.changePercent);
      if (!symbol || relativeToQqq === null || changePercent === null) return null;
      const driverType = DRIVER_TYPES.has(item?.driverType) ? item.driverType : (DRIVER_TYPES.has(item?.classification) ? item.classification : "unclear");
      return { symbol, changePercent, relativeToQqq, driverType };
    }).filter(Boolean).slice(0, 8),
    news: (Array.isArray(source.news) ? source.news : []).map(function (item) {
      const title = String(item?.title || "").trim().slice(0, 120);
      const url = String(item?.url || "").trim().slice(0, 300);
      if (!title || !/^https:\/\//i.test(url)) return null;
      const driverType = DRIVER_TYPES.has(item?.driverType) ? item.driverType : "unclear";
      return { title, url, driverType };
    }).filter(Boolean).slice(0, 2),
    earnings: (Array.isArray(source.earnings) ? source.earnings : []).map(function (item) {
      const symbol = sanitizeSymbol(item?.symbol);
      if (!symbol) return null;
      return {
        symbol,
        marketDate: String(item?.marketDate || "").trim().slice(0, 10),
        status: String(item?.status || "scheduled").trim().slice(0, 24),
        fiscalPeriod: String(item?.fiscalPeriod || "").trim().slice(0, 40)
      };
    }).filter(Boolean).slice(0, 4),
    scenario: {
      status: String(source.scenario?.status || "awaiting_target").trim().slice(0, 40),
      sample: {
        candidateCount: Math.max(0, Math.floor(Number(source.scenario?.sample?.candidateCount) || 0)),
        isSmallSample: source.scenario?.sample?.isSmallSample === true
      },
      outcomes: source.scenario?.outcomes && typeof source.scenario.outcomes === "object" ? {
        return5d: sanitizeOutcome(source.scenario.outcomes.return5d),
        return20d: sanitizeOutcome(source.scenario.outcomes.return20d),
        maxDrawdown20d: sanitizeOutcome(source.scenario.outcomes.maxDrawdown20d)
      } : {}
    },
    observations
  };
}

function sanitizeOutcome(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    medianPercent: finiteNumber(source.medianPercent),
    p25Percent: finiteNumber(source.p25Percent),
    p75Percent: finiteNumber(source.p75Percent),
    positiveRatePercent: finiteNumber(source.positiveRatePercent)
  };
}

function factsForTemplate(facts) {
  return {
    ...facts,
    observations: facts.observations.map(function (item) {
      return {
        symbol: item.symbol,
        kind: item.kind,
        priority: 1,
        alignedWithQqq: item.alignedWithQqq,
        changePercent: null
      };
    })
  };
}

function readingText(reading) {
  return JSON.stringify(reading || {});
}

function normalizePercent(token) {
  const number = Number(String(token).replace("%", "").replace("+", ""));
  if (!Number.isFinite(number)) return null;
  return (number > 0 ? "+" : "") + number.toFixed(2) + "%";
}

function collectPercents(text) {
  const values = new Set();
  (String(text).match(/[+-]?\d+(?:\.\d+)?%/g) || []).forEach(function (token) {
    const normalized = normalizePercent(token);
    if (normalized) values.add(normalized);
  });
  return values;
}

function templatePlainText(template) {
  const sections = Array.isArray(template?.sections) ? template.sections : [];
  return sections.map(function (section) {
    return String(section?.title || "") + " " + (Array.isArray(section?.paragraphs) ? section.paragraphs.join(" ") : "");
  }).join("\n") + " " + String(template?.marketDate || "");
}

function collectDates(text) {
  return new Set(String(text || "").match(/\d{4}-\d{2}-\d{2}/g) || []);
}

function collectTickers(text) {
  return new Set((String(text || "").match(/\b[A-Z]{2,5}\b/g) || []).filter(function (token) {
    return !/^Q[1-4]$/.test(token) && !TICKER_ALLOWLIST_EXTRA.has(token);
  }));
}

function allowedTickers(template) {
  const tickers = collectTickers(templatePlainText(template));
  tickers.add("QQQ");
  return tickers;
}

function extractInterpretationParagraphs(payload) {
  if (Array.isArray(payload?.paragraphs)) return payload.paragraphs;
  if (Array.isArray(payload?.interpretation?.paragraphs)) return payload.interpretation.paragraphs;
  return [];
}

export function validateBeginnerReadingInterpretation(template, payload, facts) {
  const errors = [];
  const paragraphs = extractInterpretationParagraphs(payload)
    .map(function (item) { return String(item || "").trim(); })
    .filter(Boolean);
  if (paragraphs.length < MIN_INTERPRET_PARAGRAPHS || paragraphs.length > MAX_INTERPRET_PARAGRAPHS) {
    errors.push("paragraph_count");
  }
  paragraphs.forEach(function (paragraph) {
    if (paragraph.length > MAX_INTERPRET_PARAGRAPH_CHARS) errors.push("paragraph_too_long");
  });
  const text = paragraphs.join("\n");
  if (!text) {
    return { valid: false, errors: Array.from(new Set(errors.concat(["missing_interpretation"]))), paragraphs: [] };
  }
  if (containsBannedBeginnerReading(text)) errors.push("prohibited_language");
  if (META_LAYOUT_PATTERN.test(text)) errors.push("layout_tour");
  const sourceText = templatePlainText(template);
  const allowedPercents = collectPercents(sourceText);
  collectPercents(text).forEach(function (value) {
    if (!allowedPercents.has(value)) errors.push("invented_percent");
  });
  const allowedDates = collectDates(sourceText);
  collectDates(text).forEach(function (value) {
    if (!allowedDates.has(value)) errors.push("invented_date");
  });
  const tickers = allowedTickers(template);
  collectTickers(text).forEach(function (token) {
    if (!tickers.has(token)) errors.push("unknown_ticker");
  });
  if (!DISCIPLINE_LABELS.some(function (label) { return sourceText.includes(label); })) {
    if (DISCIPLINE_LABELS.some(function (label) { return text.includes(label); })) {
      errors.push("invented_discipline");
    }
  }
  try {
    assertSafeBeginnerReadingText(text);
  } catch (_error) {
    if (!errors.includes("prohibited_language")) errors.push("prohibited_language");
  }
  return {
    valid: errors.length === 0,
    errors: Array.from(new Set(errors)),
    paragraphs
  };
}

export function validatePolishedReading(template, payload, facts) {
  return validateBeginnerReadingInterpretation(template, payload, facts);
}

export function buildBeginnerReadingPolishRequest(template, facts, config) {
  return applyJsonModeRequestDefaults({
    model: config.model,
    temperature: 0.2,
    max_tokens: config.maxOutputTokens,
    messages: [
      {
        role: "system",
        content: [
          "Return exactly one JSON object and no markdown.",
          "You are a patient investing tutor writing for a complete beginner. Read today's facts and explain what they MEAN, in plain Chinese.",
          "Output {paragraphs: string[]} with 2 or 3 short Chinese paragraphs, each under 280 characters.",
          "SKIP every empty section entirely — if there is no news, no earnings, no comparable quotes, no discipline trigger, say NOTHING about it. Use the space for what IS there.",
          "Open with ONE main takeaway sentence that weaves together the strongest signals from all non-empty sections (e.g. 今天温和收涨、但历史上这类日子短期偏强中期转弱，要注意颠簸). Then expand in the remaining paragraphs.",
          "Do NOT just restate the numbers. Translate each number into everyday meaning: turn a small positive percent into 温和收涨, a large one into 明显走强; when short-term up-rate is high but long-term is lower, name it 短强中弱的分化信号; when a drawdown figure exists, remind that even in up cases history saw a meaningful pullback of that size.",
          "You may reference a percentage ONLY if that exact percentage already appears in the template; never introduce a number of your own, and never do arithmetic (no differences, sums, or derived rates). Do NOT approximate or round a template number (never write 约6% for a -5.98% figure) — either quote it exactly as written, or describe it in words with no number at all (e.g. 明显的回撤 / 一定幅度的回落).",
          "Always frame history as a reference, never a promise. If sample count is small, flag it once as 样本太少、结论不牢 and move on.",
          "Talk about what today means, not the page layout. Do not say 格子, 五段, 第一格, 卡片, or 拆成.",
          "Any ticker, percent, date, or discipline label you mention must already appear in the template. Do not invent numbers, and do not give buy/sell/hold advice or probabilities of what will happen next."
        ].join(" ")
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Explain today's facts to a beginner so they understand what it means. Output {paragraphs:[]} only.",
          version: BEGINNER_READING_VERSION,
          marketDate: template.marketDate,
          mode: template.mode,
          sections: template.sections
        })
      }
    ]
  });
}

function safeResult(result) {
  return {
    ok: result.status === "accepted",
    status: result.status,
    reason: result.reason || null,
    interpreted: result.status === "accepted",
    polished: false,
    interpretation: result.interpretation || null,
    reading: result.reading || null,
    validationErrorCount: Array.isArray(result.validationErrors) ? result.validationErrors.length : 0
  };
}

async function persistPolishAudit(facts, output, metadata, requestImpl, config) {
  const outputFingerprint = fingerprint(output || { rejected: true });
  try {
    await requestImpl(config, "/rest/v1/research_narrative_audits", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: {
        market_date: facts.marketDate,
        packet_contract_version: BEGINNER_READING_POLISH_VERSION,
        packet_fingerprint: metadata.packetFingerprint,
        narrative_contract_version: BEGINNER_READING_VERSION,
        output_fingerprint: outputFingerprint,
        provider: POLISH_PROVIDER,
        model: metadata.model,
        status: metadata.status,
        failure_code: metadata.status === "accepted" ? null : "narrative_contract_invalid",
        narrative: output || {},
        validation_errors: metadata.validationErrors || [],
        metadata: {
          runId: "beginner-reading-interpret",
          generatedAt: new Date().toISOString(),
          latencyMs: metadata.latencyMs || null,
          task: BEGINNER_READING_POLISH_VERSION
        }
      }
    });
  } catch (_error) {
    // market_days FK or audit table issues must not block returning a validated polish.
  }
  return outputFingerprint;
}

export async function runBeginnerReadingPolish(input, options = {}) {
  const env = options.env || process.env;
  const config = options.config || isBeginnerReadingPolishConfigured(env);
  if (!config.enabled) {
    return safeResult({ status: "disabled", reason: config.reason });
  }
  let facts;
  let template;
  try {
    facts = sanitizeBeginnerReadingFacts(input);
    template = buildBeginnerReading(factsForTemplate(facts), { now: options.now });
  } catch (error) {
    return safeResult({ status: "rejected", reason: "invalid_reading_input" });
  }
  const packetFingerprint = fingerprint(facts);
  const shouldTouchStore = options.skipDailyLimit !== true;
  const requestDb = options.requestSupabase || (shouldTouchStore ? requestSupabase : null);
  const supabaseConfig = options.supabaseConfig || (shouldTouchStore ? getSupabaseConfig() : null);
  const startedAt = Date.now();
  let payloadObject = null;
  let validation = { valid: false, errors: ["gateway_request_failed"], paragraphs: [] };
  try {
    const payload = await (options.requestModel || requestDeepSeek)(
      buildBeginnerReadingPolishRequest(template, facts, config),
      config,
      options.fetchImpl
    );
    payloadObject = parseDeepSeekResponse(payload);
    validation = validateBeginnerReadingInterpretation(template, payloadObject, facts);
  } catch (error) {
    validation = { valid: false, errors: [String(error?.message || "gateway_request_failed").slice(0, 80)], paragraphs: [] };
  }
  const accepted = validation.valid;
  const interpretation = accepted ? {
    version: BEGINNER_READING_INTERPRET_VERSION,
    marketDate: template.marketDate,
    mode: template.mode,
    generatedAt: new Date().toISOString(),
    paragraphs: validation.paragraphs
  } : null;
  if (shouldTouchStore) {
    await persistPolishAudit(facts, accepted ? interpretation : { modelResponseRejected: true }, {
      packetFingerprint,
      model: config.model,
      status: accepted ? "accepted" : "rejected",
      validationErrors: validation.errors,
      latencyMs: Date.now() - startedAt
    }, requestDb, supabaseConfig);
  }
  if (!accepted) {
    return safeResult({
      status: "rejected",
      reason: "interpretation_validation_failed",
      reading: template,
      interpretation: null,
      validationErrors: validation.errors
    });
  }
  return safeResult({
    status: "accepted",
    reading: template,
    interpretation,
    validationErrors: []
  });
}

export async function handleBeginnerReadingPolishRequest(req, res) {
  const send = function (statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload));
  };
  if (req.method === "GET") {
    const config = isBeginnerReadingPolishConfigured(process.env);
    send(200, {
      ok: true,
      polishEnabled: config.enabled,
      interpretEnabled: config.enabled,
      reason: config.enabled ? null : config.reason
    });
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    send(405, { ok: false, error: "Method not allowed" });
    return;
  }
  let body = req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body) ? req.body : null;
  if (!body) {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString("utf8");
      body = raw ? JSON.parse(raw) : {};
    } catch (_error) {
      send(400, { ok: false, status: "rejected", reason: "invalid_json" });
      return;
    }
  }
  const result = await runBeginnerReadingPolish(body.input, { now: new Date() });
  const statusCode = result.status === "accepted" ? 200 : (result.status === "disabled" || result.status === "skipped" ? 409 : 502);
  send(statusCode, result);
}
