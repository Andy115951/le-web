const assert = require("node:assert/strict");
const test = require("node:test");
const { isAuthorizedCronRequest } = require("../lib/cron-auth");

test("cron auth rejects missing and incorrect secrets", function () {
  process.env.CRON_SECRET = "correct-secret";
  assert.equal(isAuthorizedCronRequest({ headers: {} }), false);
  assert.equal(isAuthorizedCronRequest({ headers: { authorization: "Bearer wrong-secret" } }), false);
});

test("cron auth accepts the configured bearer secret", function () {
  process.env.CRON_SECRET = "correct-secret";
  assert.equal(isAuthorizedCronRequest({
    headers: { authorization: "Bearer correct-secret" }
  }), true);
});

