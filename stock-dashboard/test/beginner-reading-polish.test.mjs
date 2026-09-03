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

  const unsupportedOutlook = validateBeginnerReadingInterpretation(template, {
    paragraphs: [
      "市场短强中弱，接下来仍可能震荡。",
      "建议保持谨慎，等待更清晰的方向。"
    ]
  }, facts);
  assert.equal(unsupportedOutlook.valid, false);
  assert.equal(unsupportedOutlook.errors.includes("forward_looking_claim"), true);
  assert.equal(unsupportedOutlook.errors.includes("actionable_advice"), true);
});

test("interpretation cannot tour the five boxes or name tickers missing from the template", function () {
  const emptyTape = buildBeginnerReading({
    marketDate: "2026-08-24",
    mode: "intraday",
    qqqChangePercent: null,
    components: [{ symbol: "META", changePercent: -1, relativeToQqq: -1, driverType: "unclear" }],
    news: [],
    earnings: [],
    scenario: { status: "awaiting_target" },
    observations: []
  }, { now: generatedAt });
  const facts = sanitizeBeginnerReadingFacts({
    marketDate: "2026-08-24",
    components: [{ symbol: "META", changePercent: -1, relativeToQqq: -1, driverType: "unclear" }],
    observations: [{ symbol: "TSLA", kind: "drawdown_rule" }]
  });
  const layout = validateBeginnerReadingInterpretation(emptyTape, {
    paragraphs: [
      "这份阅读把市场拆成五个小格子。第一格看大盘，第二格看像 META、TSLA 这些权重股。",
      "第五格提到回撤纪律，但当天无法对照 QQQ。"
    ]
  }, facts);
  assert.equal(layout.valid, false);
  assert.equal(layout.errors.includes("layout_tour"), true);
  assert.equal(layout.errors.includes("unknown_ticker"), true);
  assert.equal(layout.errors.includes("invented_discipline"), true);

  const hiddenEmptyState = validateBeginnerReadingInterpretation(emptyTape, {
    paragraphs: [
      "今天没有纳指基准，所以没法判断大盘，也没法对照权重股相对 QQQ 的偏离。",
      "公开资讯、历史样本和个人纪律都还连不上，不能把空状态补成故事。"
    ]
  }, facts);
  assert.equal(hiddenEmptyState.valid, false);
  assert.equal(hiddenEmptyState.errors.includes("hidden_empty_state"), true);
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
  assert.equal(BEGINNER_READING_INTERPRET_VERSION, "beginner-reading-interpret-v2");
  assert.equal(result.status, "accepted");
  assert.equal(result.interpreted, true);
  assert.equal(result.polished, false);
  assert.deepEqual(result.interpretation.paragraphs, paragraphs);
  assert.equal(result.reading.sections.length, 5);
  assert.equal(result.reading.sections[0].paragraphs[0], template.sections[0].paragraphs[0]);
});

test("interpretation is not blocked by prior daily attempts", async function () {
  const paragraphs = [
    "今天没有纳指基准，所以没法判断大盘。",
    "公开资讯和历史样本都还连不上。"
  ];
  let modelCalls = 0;
  const result = await runBeginnerReadingPolish(baseInput(), {
    env: enabledEnv(),
    skipDailyLimit: false,
    supabaseConfig: {},
    now: new Date(generatedAt),
    requestSupabase: async function () {
      return [
        { id: "1", created_at: generatedAt },
        { id: "2", created_at: generatedAt },
        { id: "3", created_at: generatedAt }
      ];
    },
    requestModel: async function () {
      modelCalls += 1;
      return { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ paragraphs }) } }] };
    }
  });
  assert.equal(result.status, "accepted");
  assert.equal(result.interpreted, true);
  assert.equal(modelCalls, 1);
});

test("interpretation request sends the template and not raw page facts", async function () {
  let sent = null;
  await runBeginnerReadingPolish(baseInput(), {
    env: enabledEnv(),
    skipDailyLimit: true,
    now: new Date(generatedAt),
    requestModel: async function (payload) {
      sent = payload;
      return { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ paragraphs: ["占位一。", "占位二。"] }) } }] };
    }
  });
  const user = JSON.parse(sent.messages[1].content);
  assert.equal(user.facts, undefined);
  assert.equal(Array.isArray(user.sections), true);
  assert.equal(JSON.stringify(user).includes("shares"), false);
});

test("interpretation request omits noise-only empty sections", async function () {
  let sent = null;
  const result = await runBeginnerReadingPolish({
    marketDate: "2026-08-24",
    mode: "intraday",
    qqqChangePercent: null,
    components: [{ symbol: "META", changePercent: -1, relativeToQqq: -1, driverType: "unclear" }],
    news: [],
    earnings: [],
    scenario: { status: "awaiting_target" },
    observations: []
  }, {
    env: enabledEnv(),
    skipDailyLimit: true,
    now: new Date(generatedAt),
    requestModel: async function (payload) {
      sent = payload;
      return { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
        paragraphs: [
          "盘中没有纳指基准，不能把盘中价当成收盘结论。",
          "历史样本还不够，今天也没有触发你设置的纪律。"
        ]
      }) } }] };
    }
  });
  const user = JSON.parse(sent.messages[1].content);
  assert.equal(result.status, "accepted");
  assert.equal(user.sections.some(function (section) { return section.id === "leaders"; }), false);
  assert.equal(user.sections.some(function (section) { return section.id === "news_calendar"; }), false);
});
