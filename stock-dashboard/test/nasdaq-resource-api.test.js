const assert = require("node:assert/strict");
const test = require("node:test");
const handler = require("../api/nasdaq/[resource]");

function responseRecorder() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); }
  };
}

test("earnings resource rejects an invalid status before requiring server configuration", async function () {
  const res = responseRecorder();
  await handler({ method: "GET", query: { resource: "earnings", start: "2026-08-01", end: "2026-08-31", status: "invented" } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.deepEqual(res.body, { ok: false, error: "Invalid earnings status; expected scheduled, reported, or cancelled" });
});

test("Nasdaq resource remains read-only", async function () {
  const res = responseRecorder();
  await handler({ method: "POST", query: { resource: "earnings" } }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "GET");
});
