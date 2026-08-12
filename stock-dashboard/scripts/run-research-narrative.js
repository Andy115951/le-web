const { normalizeDate } = require("../lib/market-calendar");
const { getResearchPacketSnapshots } = require("../lib/research-packet-snapshots");
const { runDeepSeekResearchNarrative } = require("../lib/deepseek-research-narrative");

async function main() {
  const date = normalizeDate(process.argv[2]);
  const result = await getResearchPacketSnapshots({ date, includePacket: true, limit: 30 });
  const snapshot = result.snapshots.find(function (item) { return item?.packet; });
  if (!snapshot?.packet) {
    throw new Error("No archived research packet exists for " + date + "; create the snapshot before running a model");
  }
  const run = await runDeepSeekResearchNarrative(snapshot.packet, {
    runId: "manual-narrative-" + date
  });
  console.log(JSON.stringify({
    date,
    status: run.status,
    reason: run.reason || null,
    created: Boolean(run.created),
    packetFingerprint: run.packetFingerprint || null,
    auditId: run.audit?.id || null,
    validationErrorCount: Array.isArray(run.validationErrors) ? run.validationErrors.length : 0
  }, null, 2));
}

main().catch(function (error) {
  console.error("Research narrative run failed:", error?.message || error);
  process.exitCode = 1;
});
