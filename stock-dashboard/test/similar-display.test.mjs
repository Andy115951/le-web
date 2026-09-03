import assert from "node:assert/strict";
import test from "node:test";
import { getSimilarMatchComponents } from "../lib/similar-display.mjs";

test("similar-match display exposes only finite scored dimensions", function () {
  assert.deepEqual(getSimilarMatchComponents({
    momentum_score: 91.2,
    risk_score: "82.7",
    participation_score: null,
    event_score: 72
  }), [
    { key: "momentum", label: "动量", score: 91.2 },
    { key: "risk", label: "风险", score: 82.7 },
    { key: "event", label: "当时已知事件", score: 72 }
  ]);
});

test("similar-match display supports camel-case API values and hides invalid scores", function () {
  assert.deepEqual(getSimilarMatchComponents({ momentumScore: 50, riskScore: "not-a-number", eventScore: 0 }), [
    { key: "momentum", label: "动量", score: 50 },
    { key: "event", label: "当时已知事件", score: 0 }
  ]);
});
