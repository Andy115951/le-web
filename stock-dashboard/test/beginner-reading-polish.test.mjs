import assert from "node:assert/strict";
import test from "node:test";
import { buildBeginnerReading } from "../lib/beginner-reading.mjs";
import {
  BEGINNER_READING_INTERPRET_VERSION,
  isBeginnerReadingPolishConfigured,
  runBeginnerReadingPolish,
  sanitizeBeginnerReadingFacts,
  validateBeginnerReadingInterpretation
} from "../lib/beginner-reading-polish.mjs";

const generatedAt = "2026-08-24T16:00:00.000Z";

function baseInput() {
  return {
    marketDate: "2026-08-21",
    mode: "close",
    qqqChangePercent: -1.2,
    magsChangePercent: -1.5,
    volatilityLevel: "elevated",
    components: [
      { symbol: "NVDA", changePercent: -3.4, relativeToQqq: -2.2, driverType: "company", shares: 99, costBasis: 12 }
    ],
    news: [{ title: "NVIDIA comments", url: "https://investor.nvidia.com/example", driverType: "company" }],
    earnings: [{ symbol: "NVDA", marketDate: "2026-08-26", status: "scheduled", fiscalPeriod: "FY2027 Q2" }],
    scenario: { status: "insufficient_samples" },
    observations: [{ symbol: "NVDA", kind: "drawdown_rule", alignedWithQqq: true, shares: 10 }]
  };
}

function enabledEnv() {
  return {
    DEEPSEEK_BEGINNER_READING_ENABLED: "true",
    DEEPSEEK_API_KEY: "a".repeat(24),
    DEEPSEEK_MODEL: "deepseek-v4-flash",
    DEEPSEEK_API_URL: "https://gateway.example/v1/chat/completions"
  };
}

test("polish stays disabled until its dedicated switch is on", function () {
  assert.deepEqual(isBeginnerReadingPolishConfigured({}), { enabled: false, reason: "disabled" });
  assert.equal(isBeginnerReadingPolishConfigured(enabledEnv()).enabled, true);
});

test("sanitize drops holdings quantity and cost fields", function () {
  const facts = sanitizeBeginnerReadingFacts(baseInput());
  assert.equal(JSON.stringify(facts).includes("shares"), false);
  assert.equal(JSON.stringify(facts).includes("costBasis"), false);
  assert.equal(facts.observations[0].kind, "drawdown_rule");
  assert.equal(facts.observations[0].alignedWithQqq, true);
  assert.equal(facts.observations[0].changePercent, undefined);
});

test("interpretation validation accepts teaching paragraphs and rejects invented facts", function () {
  const template = buildBeginnerReading(baseInput(), { now: generatedAt });
  const facts = sanitizeBeginnerReadingFacts(baseInput());
  const valid = validateBeginnerReadingInterpretation(template, {
    paragraphs: [
      "QQQ 当日 -1.20%，NVDA 相对更弱。把这理解成同屏已经算好的关系，不是新的涨跌原因。",
      "NVDA FY2027 Q2 还在日历上，不能拿来解释 2026-08-21。"
    ]
  }, facts);
  assert.equal(valid.valid, true);
  assert.equal(valid.paragraphs.length, 2);

  const invalid = validateBeginnerReadingInterpretation(template, {
    paragraphs: ["QQQ 当日 +9.99%。该买。"]
  }, facts);
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.includes("paragraph_count"), true);
  assert.equal(invalid.errors.includes("invented_percent"), true);
  assert.equal(invalid.errors.includes("prohibited_language"), true);
});

test("disabled polish does not call a model", async function () {
  let requested = false;
  const result = await runBeginnerReadingPolish(baseInput(), {
    env: {},
    requestModel: async function () { requested = true; }
  });
  assert.equal(result.status, "disabled");
  assert.equal(result.interpreted, false);
  assert.equal(result.interpretation, null);
  assert.equal(requested, false);
});

test("failed interpretation keeps the template reading", async function () {
  const template = buildBeginnerReading({
    ...sanitizeBeginnerReadingFacts(baseInput()),
    observations: [{ symbol: "NVDA", kind: "drawdown_rule", alignedWithQqq: true }]
  }, { now: generatedAt });
  const result = await runBeginnerReadingPolish(baseInput(), {
    env: enabledEnv(),
    skipDailyLimit: true,
    now: new Date(generatedAt),
    requestModel: async function () {
      return { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ paragraphs: [] }) } }] };
    }
  });
  assert.equal(result.status, "rejected");
  assert.equal(result.interpreted, false);
  assert.equal(result.interpretation, null);
  assert.equal(result.reading.sections.length, 5);
  assert.equal(result.reading.marketDate, template.marketDate);
  assert.deepEqual(result.reading.sections.map(function (item) { return item.id; }), template.sections.map(function (item) { return item.id; }));
});

test("accepted interpretation is a separate panel and does not replace the template", async function () {
  const facts = sanitizeBeginnerReadingFacts(baseInput());
  const template = buildBeginnerReading({
    ...facts,
    observations: facts.observations.map(function (item) {
      return { symbol: item.symbol, kind: item.kind, alignedWithQqq: item.alignedWithQqq };
    })
  }, { now: generatedAt });
  const paragraphs = [
    "先看 QQQ 当日 -1.20% 和 MAGS，再对照 NVDA 相对 QQQ 的偏离。",
    "NVIDIA comments 已经出现；FY2027 Q2 仍是预定事项，不能解释今天。",
    "历史对照样本不够时，只把它当线索，不当预测。"
  ];
  const result = await runBeginnerReadingPolish(baseInput(), {
    env: enabledEnv(),
    skipDailyLimit: true,
    now: new Date(generatedAt),
    requestModel: async function () {
      return { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ paragraphs }) } }] };
    }
  });
  assert.equal(BEGINNER_READING_INTERPRET_VERSION, "beginner-reading-interpret-v1");
  assert.equal(result.status, "accepted");
  assert.equal(result.interpreted, true);
  assert.equal(result.polished, false);
  assert.deepEqual(result.interpretation.paragraphs, paragraphs);
  assert.equal(result.reading.sections.length, 5);
  assert.equal(result.reading.sections[0].paragraphs[0], template.sections[0].paragraphs[0]);
});
