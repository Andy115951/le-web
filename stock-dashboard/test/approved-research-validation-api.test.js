const assert = require("node:assert/strict");
const test = require("node:test");
const handler = require("../api/cron/validate-approved-research-snapshot");

function responseRecorder() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); }
  };
}

test("approved validation endpoint only allows POST", async function () {
  const res = responseRecorder();
  await handler({ method: "GET", headers: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "POST");
  assert.deepEqual(res.body, { error: "Method not allowed" });
});

test("approved validation endpoint requires the cron bearer secret", async function () {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "correct-secret";
  const res = responseRecorder();
  await handler({ method: "POST", headers: { authorization: "Bearer wrong-secret" } }, res);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Unauthorized" });
  if (previous === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previous;
});
