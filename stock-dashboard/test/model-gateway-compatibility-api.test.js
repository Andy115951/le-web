const assert = require("node:assert/strict");
const test = require("node:test");
const handler = require("../api/cron/check-model-gateway-compatibility");

function responseRecorder() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); }
  };
}

test("gateway compatibility endpoint only allows authenticated POST requests", async function () {
  const methodRes = responseRecorder();
  await handler({ method: "GET", headers: {} }, methodRes);
  assert.equal(methodRes.statusCode, 405);
  assert.equal(methodRes.headers.Allow, "POST");

  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "correct-secret";
  const authRes = responseRecorder();
  await handler({ method: "POST", headers: { authorization: "Bearer wrong-secret" } }, authRes);
  assert.equal(authRes.statusCode, 401);
  assert.deepEqual(authRes.body, { error: "Unauthorized" });
  if (previous === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previous;
});
