const { buildEventReviewFocus, getEventReviewQueue, recordEventReviewDecision } = require("../lib/event-review");

const command = String(process.argv[2] || "list").toLowerCase();

function buildReviewSummary(queue) {
  const value = queue && typeof queue === "object" ? queue : {};
  const triage = value.triage && typeof value.triage === "object" ? value.triage : {};
  return {
    version: value.version || null,
    days: Number(value.days) || null,
    totalCount: Number(value.totalCount) || 0,
    needsAttentionCount: Number(value.needsAttentionCount) || 0,
    unreviewedCount: Number(value.unreviewedCount) || 0,
    triage: {
      attentionCount: Number(triage.attentionCount) || 0,
      byFlag: Array.isArray(triage.byFlag) ? triage.byFlag : [],
      byEventType: Array.isArray(triage.byEventType) ? triage.byEventType : []
    }
  };
}

function buildReviewFocus(queue, limit) {
  const value = queue && typeof queue === "object" ? queue : {};
  return {
    version: value.version || null,
    days: Number(value.days) || null,
    focus: buildEventReviewFocus(value.items, limit)
  };
}

async function run() {
  if (command === "list") {
    const result = await getEventReviewQueue(process.argv[3]);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return;
  }
  if (command === "summary") {
    const result = await getEventReviewQueue(process.argv[3]);
    process.stdout.write(JSON.stringify(buildReviewSummary(result), null, 2) + "\n");
    return;
  }
  if (command === "focus") {
    const result = await getEventReviewQueue(process.argv[3]);
    process.stdout.write(JSON.stringify(buildReviewFocus(result, process.argv[4]), null, 2) + "\n");
    return;
  }
  if (command === "decide") {
    const result = await recordEventReviewDecision({
      eventKey: process.argv[3],
      reviewStatus: process.argv[4],
      reviewer: process.argv[5],
      reviewNote: process.argv.slice(6).join(" ")
    });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return;
  }
  throw new Error("Usage: list [30|90|180] | summary [30|90|180] | focus [30|90|180] [1..20] | decide <event-key> <accepted|rejected|needs_attention> <reviewer> [note]");
}

if (require.main === module) {
  run().catch(function (error) {
    process.stderr.write((error?.message || String(error)) + "\n");
    process.exitCode = 1;
  });
}

module.exports = { buildReviewFocus, buildReviewSummary };
