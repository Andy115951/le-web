import assert from "node:assert/strict";
import test from "node:test";
import { getEarningsTimingPresentation, getEarningsViewCopy, getEarningsViewRange, normalizeEarningsViewMode, selectEarningsForView } from "../lib/earnings-display.mjs";

test("earnings display ranges switch between upcoming and recently reported windows", function () {
  assert.deepEqual(getEarningsViewRange("2026-08-15", "upcoming"), { startDate: "2026-08-15", endDate: "2026-09-14" });
  assert.deepEqual(getEarningsViewRange("2026-08-15", "reported"), { startDate: "2026-07-16", endDate: "2026-08-15" });
  assert.equal(getEarningsViewRange("bad-date", "upcoming"), null);
  assert.equal(normalizeEarningsViewMode("unsupported"), "upcoming");
});

test("recently reported view excludes scheduled entries and sorts newest first", function () {
  const events = [
    { symbol: "NEXT", marketDate: "2026-08-18", status: "scheduled" },
    { symbol: "OLD", marketDate: "2026-07-20", status: "reported" },
    { symbol: "NEW", marketDate: "2026-08-02", status: "reported" },
    { symbol: "BROKEN", marketDate: "not-a-date", status: "reported" }
  ];
  assert.deepEqual(selectEarningsForView(events, "reported").map(function (event) { return event.symbol; }), ["NEW", "OLD"]);
  assert.deepEqual(selectEarningsForView(events, "upcoming").map(function (event) { return event.symbol; }), ["OLD", "NEW", "NEXT"]);
  assert.match(getEarningsViewCopy("reported").emptyTitle, /最近 30 天/);
});

test("reported earnings only present a published time when the official source has one", function () {
  assert.deepEqual(getEarningsTimingPresentation({
    status: "reported",
    scheduledAt: "2026-07-30T20:00:00.000Z",
    source: { publishedAt: "2026-07-30T20:04:00.000Z" }
  }), { kind: "published_at", value: "2026-07-30T20:04:00.000Z" });
  assert.deepEqual(getEarningsTimingPresentation({ status: "reported", session: "after_market" }), { kind: "session", value: "after_market" });
  assert.deepEqual(getEarningsTimingPresentation({ status: "scheduled", scheduledAt: "2026-08-26T20:20:00.000Z" }), { kind: "scheduled_at", value: "2026-08-26T20:20:00.000Z" });
});
