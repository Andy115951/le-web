const assert = require("node:assert/strict");
const test = require("node:test");
const handler = require("../api/cron/market-history-runs");

function responseRecorder() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); }
  };
}

test("capture run diagnostics require Cron auth before validating a selected run", async function () {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "correct-secret";
  const unauthorized = responseRecorder();
  await handler({ method: "GET", query: { runId: "not-valid" }, headers: {} }, unauthorized);
  assert.equal(unauthorized.statusCode, 401);

  const invalid = responseRecorder();
  await handler({ method: "GET", query: { runId: "not-valid" }, headers: { authorization: "Bearer correct-secret" } }, invalid);
  assert.equal(invalid.statusCode, 400);
  assert.deepEqual(invalid.body, { error: "Invalid run id" });
  if (previous === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previous;
});
