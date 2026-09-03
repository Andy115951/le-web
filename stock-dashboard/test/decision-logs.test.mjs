import assert from "node:assert/strict";
import test from "node:test";
import {
  createDecisionLog,
  deleteDecisionLog,
  getActiveDecisionLogs,
  needsDecisionLogWriteBack,
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
  assert.equal(entry.version, "decision-log-v3");
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

test("deleted decision tombstones converge across devices and keep private entry fields out", function () {
  const entry = createDecisionLog({
    id: "decision:fixed",
    marketDate: "2026-08-15",
    symbol: "NVDA",
    action: "sold",
    rationale: "个人理由不应保留在删除标记中",
    createdAt,
    updatedAt: createdAt,
    snapshot: { capturedAt: createdAt, marketDate: "2026-08-15", price: 180 }
  });
  const tombstone = deleteDecisionLog(entry, "2026-08-16T16:00:00.000Z");
  assert.deepEqual(tombstone, {
    id: "decision:fixed",
    version: "decision-log-v3",
    createdAt,
    updatedAt: "2026-08-16T16:00:00.000Z",
    deletedAt: "2026-08-16T16:00:00.000Z"
  });
  const merged = mergeDecisionLogs([entry], [tombstone]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].deletedAt, "2026-08-16T16:00:00.000Z");
  assert.deepEqual(getActiveDecisionLogs(merged), []);
  assert.equal(applyOutcome(tombstone, { outcome: "worked" }), null);
});

test("a deletion wins an exact timestamp tie so stale devices cannot restore it", function () {
  const entry = createDecisionLog({ id: "decision:tie", marketDate: "2026-08-15", symbol: "NVDA", action: "hold", createdAt, updatedAt: "2026-08-16T16:00:00.000Z" });
  const tombstone = deleteDecisionLog(entry, "2026-08-16T16:00:00.000Z");
  const merged = mergeDecisionLogs([tombstone], [entry]);
  assert.equal(merged[0].deletedAt, "2026-08-16T16:00:00.000Z");
});

test("tombstones are not pruned by the active decision-log cap", function () {
  const tombstones = Array.from({ length: 501 }, function (_value, index) {
    const deletedAt = new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString();
    return { id: "decision:deleted:" + index, createdAt, updatedAt: deletedAt, deletedAt };
  });
  const normalized = normalizeDecisionLogs(tombstones);
  assert.equal(normalized.length, 501);
  assert.equal(getActiveDecisionLogs(normalized).length, 0);
});

test("a merged tombstone requests one cloud write-back when remote is stale", function () {
  const entry = createDecisionLog({ id: "decision:offline", marketDate: "2026-08-15", symbol: "NVDA", action: "hold", createdAt, updatedAt: createdAt });
  const tombstone = deleteDecisionLog(entry, "2026-08-17T16:00:00.000Z");
  const merged = mergeDecisionLogs([tombstone], [entry]);
  assert.equal(needsDecisionLogWriteBack([entry], merged), true);
  assert.equal(needsDecisionLogWriteBack(merged, merged), false);
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

test("decision snapshots retain only bounded private context for new records", function () {
  const entry = createDecisionLog({
    marketDate: "2026-08-15",
    symbol: "NVDA",
    action: "trimmed",
    createdAt,
    snapshot: {
      capturedAt: createdAt,
      marketDate: "2026-08-15",
      price: 180.123456,
      changePercent: -1.23456,
      peakPrice: 200.98765,
      costBasis: 120.12345,
      shares: 12.345678,
      holdingType: "core",
      ignored: "must not persist"
    }
  });
  assert.deepEqual(entry.snapshot, {
    capturedAt: createdAt,
    marketDate: "2026-08-15",
    price: 180.1235,
    changePercent: -1.235,
    peakPrice: 200.9877,
    peakAt: null,
    targetPrice: null,
    costBasis: 120.1235,
    shares: 12.3457,
    holdingType: "core"
  });
  assert.equal(JSON.stringify(entry.snapshot).includes("ignored"), false);

  const withoutContext = createDecisionLog({
    marketDate: "2026-08-15",
    symbol: "TSLA",
    action: "watch",
    createdAt,
    snapshot: { capturedAt: createdAt, marketDate: "2026-08-15" }
  });
  assert.equal(withoutContext.snapshot, null);

  const updated = applyOutcome(entry, {
    outcome: "worked",
    now: "2026-08-20T16:00:00.000Z",
    outcomeSnapshot: { capturedAt: "2026-08-20T16:00:00.000Z", marketDate: "2026-08-20", price: 190 }
  });
  assert.equal(updated.snapshot.price, 180.1235);
  assert.equal(updated.outcomeSnapshot.price, 190);
});
