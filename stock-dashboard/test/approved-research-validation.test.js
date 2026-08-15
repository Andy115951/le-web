const assert = require("node:assert/strict");
const test = require("node:test");
const { runApprovedResearchSnapshotValidation } = require("../lib/approved-research-validation");

const fingerprint = "a".repeat(64);
const packet = {
  contractVersion: "daily-research-packet-v1",
  asOf: { marketDate: "2026-08-11" }
};

test("approved validation refuses to run until an exact fingerprint and one-time mode are configured", async function () {
  let lookedUp = false;
  const result = await runApprovedResearchSnapshotValidation({
    env: { DEEPSEEK_ONE_TIME_VALIDATION: "true" },
    findSnapshot: async function () { lookedUp = true; }
  });
  assert.equal(result.reason, "approved_packet_not_configured");
  assert.equal(lookedUp, false);
});

test("approved validation has no caller-selected packet and does not run when one-time mode is off", async function () {
  let lookedUp = false;
  const result = await runApprovedResearchSnapshotValidation({
    env: { DEEPSEEK_ALLOWED_PACKET_FINGERPRINT: fingerprint },
    findSnapshot: async function () { lookedUp = true; }
  });
  assert.equal(result.reason, "one_time_validation_not_enabled");
  assert.equal(lookedUp, false);
});

test("approved validation loads only the configured immutable packet and returns safe audit metadata", async function () {
  let receivedFingerprint = null;
  let receivedPacket = null;
  const result = await runApprovedResearchSnapshotValidation({
    env: {
      DEEPSEEK_ALLOWED_PACKET_FINGERPRINT: fingerprint,
      DEEPSEEK_ONE_TIME_VALIDATION: "true"
    },
    findSnapshot: async function (value) {
      receivedFingerprint = value;
      return { id: "snapshot-1", market_date: "2026-08-11", packet_fingerprint: fingerprint, packet };
    },
    runNarrative: async function (value, options) {
      receivedPacket = value;
      assert.equal(options.runId, "approved-one-time-validation:aaaaaaaaaaaa");
      return { status: "accepted", created: true, audit: { id: "audit-1" }, validationErrors: [] };
    }
  });
  assert.equal(receivedFingerprint, fingerprint);
  assert.equal(receivedPacket, packet);
  assert.deepEqual(result, {
    status: "accepted",
    reason: null,
    created: true,
    marketDate: "2026-08-11",
    packetFingerprint: fingerprint,
    auditId: "audit-1",
    validationErrorCount: 0
  });
});

test("approved validation refuses a storage result that does not exactly match the configured fingerprint", async function () {
  let called = false;
  const result = await runApprovedResearchSnapshotValidation({
    env: {
      DEEPSEEK_ALLOWED_PACKET_FINGERPRINT: fingerprint,
      DEEPSEEK_ONE_TIME_VALIDATION: "true"
    },
    findSnapshot: async function () {
      return { market_date: "2026-08-11", packet_fingerprint: "b".repeat(64), packet };
    },
    runNarrative: async function () { called = true; }
  });
  assert.equal(result.reason, "approved_packet_not_found");
  assert.equal(called, false);
});
