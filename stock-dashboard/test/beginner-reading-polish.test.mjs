import assert from "node:assert/strict";
import test from "node:test";
import { buildBeginnerReading } from "../lib/beginner-reading.mjs";
import {
  BEGINNER_READING_POLISH_VERSION,
  isBeginnerReadingPolishConfigured,
  runBeginnerReadingPolish,
  sanitizeBeginnerReadingFacts,
  validatePolishedReading
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

test("polish stays disabled until its dedicated switch is on", function () {
  assert.deepEqual(isBeginnerReadingPolishConfigured({}), { enabled: false, reason: "disabled" });
  assert.equal(isBeginnerReadingPolishConfigured({
    DEEPSEEK_BEGINNER_READING_ENABLED: "true",
    DEEPSEEK_API_KEY: "a".repeat(24),
    DEEPSEEK_MODEL: "deepseek-v4-flash",
    DEEPSEEK_API_URL: "https://gateway.example/v1/chat/completions"
  }).enabled, true);
});

test("sanitize drops holdings quantity and cost fields", function () {
  const facts = sanitizeBeginnerReadingFacts(baseInput());
  assert.equal(JSON.stringify(facts).includes("shares"), false);
  assert.equal(JSON.stringify(facts).includes("costBasis"), false);
  assert.equal(facts.observations[0].kind, "drawdown_rule");
  assert.equal(facts.observations[0].alignedWithQqq, true);
  assert.equal(facts.observations[0].changePercent, undefined);
});

test("polish validation accepts a same-number rewrite and rejects invented facts", function () {
  const template = buildBeginnerReading(baseInput(), { now: generatedAt });
  const facts = sanitizeBeginnerReadingFacts(baseInput());
  const polished = {
    version: "beginner-reading-v1",
    marketDate: "2026-08-21",
    mode: "close",
    sections: template.sections.map(function (section) {
      return { id: section.id, title: section.title, paragraphs: section.paragraphs.slice() };
    })
  };
  assert.equal(validatePolishedReading(template, polished, facts).valid, true);
  polished.sections[0].paragraphs = ["QQQ 当日 +9.99%。该买。"];
  const invalid = validatePolishedReading(template, polished, facts);
  assert.equal(invalid.valid, false);
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
  assert.equal(result.polished, false);
  assert.equal(requested, false);
});

test("failed polish keeps the template reading", async function () {
  const template = buildBeginnerReading({
    ...sanitizeBeginnerReadingFacts(baseInput()),
    observations: [{ symbol: "NVDA", kind: "drawdown_rule", alignedWithQqq: true }]
  }, { now: generatedAt });
  const result = await runBeginnerReadingPolish(baseInput(), {
    env: {
      DEEPSEEK_BEGINNER_READING_ENABLED: "true",
      DEEPSEEK_API_KEY: "a".repeat(24),
      DEEPSEEK_MODEL: "deepseek-v4-flash",
      DEEPSEEK_API_URL: "https://gateway.example/v1/chat/completions"
    },
    skipDailyLimit: true,
    now: new Date(generatedAt),
    requestModel: async function () {
      return { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ version: "beginner-reading-v1", marketDate: "2026-08-21", mode: "close", sections: [] }) } }] };
    }
  });
  assert.equal(result.status, "rejected");
  assert.equal(result.polished, false);
  assert.equal(result.reading.sections.length, 5);
  assert.equal(result.reading.marketDate, template.marketDate);
});

test("accepted polish replaces template only after contract checks", async function () {
  const facts = sanitizeBeginnerReadingFacts(baseInput());
  const template = buildBeginnerReading({
    ...facts,
    observations: facts.observations.map(function (item) {
      return { symbol: item.symbol, kind: item.kind, alignedWithQqq: item.alignedWithQqq };
    })
  }, { now: generatedAt });
  const polished = {
    version: "beginner-reading-v1",
    marketDate: template.marketDate,
    mode: template.mode,
    sections: template.sections.map(function (section) {
      return {
        id: section.id,
        title: section.title,
        paragraphs: section.paragraphs.map(function (paragraph) { return paragraph.replace("。", "，便于阅读。"); })
      };
    })
  };
  const result = await runBeginnerReadingPolish(baseInput(), {
    env: {
      DEEPSEEK_BEGINNER_READING_ENABLED: "true",
      DEEPSEEK_API_KEY: "a".repeat(24),
      DEEPSEEK_MODEL: "deepseek-v4-flash",
      DEEPSEEK_API_URL: "https://gateway.example/v1/chat/completions"
    },
    skipDailyLimit: true,
    now: new Date(generatedAt),
    requestModel: async function () {
      return { choices: [{ finish_reason: "stop", message: { content: JSON.stringify(polished) } }] };
    }
  });
  assert.equal(BEGINNER_READING_POLISH_VERSION, "beginner-reading-polish-v1");
  assert.equal(result.status, "accepted");
  assert.equal(result.polished, true);
  assert.equal(result.reading.sections.length, 5);
});
