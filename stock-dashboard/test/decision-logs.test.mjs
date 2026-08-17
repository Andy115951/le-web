import assert from "node:assert/strict";
import test from "node:test";
import {
  createDecisionLog,
  mergeDecisionLogs,
  normalizeDecisionLogs,
  applyOutcome
} from "../decision-logs.mjs";

const createdAt = "2026-08-15T16:00:00.000Z";

test("createDecisionLog normalizes a valid user entry", function () {
  const entry = createDecisionLog({
    marketDate: "2026-08-15",
    symbol: "nvda",
    displayName: "NVIDIA",
    action: "trimmed",
    rationale: "回撤到个人纪律位，先减一半。",
    createdAt,
    updatedAt: createdAt
  });

  assert.equal(entry.symbol, "NVDA");
  assert.equal(entry.action, "trimmed");
  assert.equal(entry.version, "decision-log-v1");
  assert.equal(entry.outcome, "pending");
  assert.equal(entry.outcomeRecordedAt, null);
  assert.equal(entry.id, "decision:" + createdAt + ":NVDA");
});

test("createDecisionLog rejects invalid action or missing symbol", function () {
  assert.equal(createDecisionLog({ marketDate: "2026-08-15", symbol: "NVDA", action: "moon", createdAt }), null);
  assert.equal(createDecisionLog({ marketDate: "2026-08-15", symbol: "", action: "hold", createdAt }), null);
  assert.equal(createDecisionLog({ marketDate: "bad-date", symbol: "NVDA", action: "hold", createdAt }), null);
});

test("createDecisionLog truncates an over-long rationale to 600 chars", function () {
  const entry = createDecisionLog({
    marketDate: "2026-08-15",
    symbol: "NVDA",
    action: "hold",
    rationale: "x".repeat(900),
    createdAt
  });
  assert.equal(entry.rationale.length, 600);
});

test("mergeDecisionLogs keeps the latest edit for an existing id (last-write-wins)", function () {
  const first = createDecisionLog({
    id: "decision:fixed",
    marketDate: "2026-08-15",
    symbol: "NVDA",
    action: "hold",
    rationale: "先观望",
    createdAt,
    updatedAt: createdAt
  });
  const second = createDecisionLog({
    id: "decision:fixed",
    marketDate: "2026-08-15",
    symbol: "NVDA",
    action: "sold",
    rationale: "破位清仓",
    createdAt,
    updatedAt: "2026-08-15T20:00:00.000Z"
  });

  const merged = mergeDecisionLogs([first], [second]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].action, "sold");
  assert.equal(merged[0].rationale, "破位清仓");
});

test("normalizeDecisionLogs dedupes, sorts by updatedAt desc and caps at 500", function () {
  const many = [];
  for (let i = 0; i < 520; i += 1) {
    const stamp = new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString();
    many.push({ id: "decision:" + i, marketDate: "2026-01-01", symbol: "NVDA", action: "hold", createdAt: stamp, updatedAt: stamp });
  }
  const normalized = normalizeDecisionLogs(many);
  assert.equal(normalized.length, 500);
  assert.ok(new Date(normalized[0].updatedAt).getTime() > new Date(normalized[1].updatedAt).getTime());
});

test("applyOutcome updates outcome fields and refreshes updatedAt", function () {
  const entry = createDecisionLog({
    marketDate: "2026-08-15",
    symbol: "NVDA",
    action: "bought",
    createdAt,
    updatedAt: createdAt
  });
  const updated = applyOutcome(entry, { outcome: "worked", outcomeNote: "反弹兑现", now: "2026-08-20T16:00:00.000Z" });

  assert.equal(updated.outcome, "worked");
  assert.equal(updated.outcomeNote, "反弹兑现");
  assert.equal(updated.outcomeRecordedAt, "2026-08-20T16:00:00.000Z");
  assert.equal(updated.updatedAt, "2026-08-20T16:00:00.000Z");
  assert.equal(updated.id, entry.id);
});
