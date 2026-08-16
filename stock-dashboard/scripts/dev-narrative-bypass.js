/**
 * One-off local test: run the research narrative bypassing the daily rate limiter.
 * Usage: node scripts/test-narrative-bypass-ratelimit.js <market-date>
 * DO NOT deploy or commit this script — it exists only to validate the pipeline locally.
 */
const { normalizeDate } = require("../lib/market-calendar");
const { getResearchPacketSnapshots } = require("../lib/research-packet-snapshots");
const { runDeepSeekResearchNarrative } = require("../lib/deepseek-research-narrative");

async function main() {
  const date = normalizeDate(process.argv[2]);
  const result = await getResearchPacketSnapshots({ date, includePacket: true, limit: 30 });
  const snapshot = result.snapshots.find(function (item) { return item?.packet; });
  if (!snapshot?.packet) {
    throw new Error("No archived research packet for " + date);
  }

  // Bypass daily rate check and extend timeout — for local testing only
  const run = await runDeepSeekResearchNarrative(snapshot.packet, {
    runId: "test-bypass-" + date,
    getAttempts: function () { return Promise.resolve([]); },
    fetchImpl: function (url, init) {
      // Replace any AbortSignal from the lib with a 60s one
      return fetch(url, { ...init, signal: AbortSignal.timeout(60000) });
    }
  });

  console.log(JSON.stringify({
    date,
    status: run.status,
    reason: run.reason || null,
    created: Boolean(run.created),
    packetFingerprint: run.packetFingerprint || null,
    auditId: run.audit?.id || null,
    validationErrorCount: Array.isArray(run.validationErrors) ? run.validationErrors.length : 0,
    validationErrors: run.validationErrors || []
  }, null, 2));
}

main().catch(function (error) {
  console.error("Test run failed:", error?.message || error);
  process.exitCode = 1;
});
