const { getEventReviewQueue, recordEventReviewDecision } = require("../lib/event-review");

const command = String(process.argv[2] || "list").toLowerCase();

async function run() {
  if (command === "list") {
    const result = await getEventReviewQueue(process.argv[3]);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
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
  throw new Error("Usage: list [30|90|180] | decide <event-key> <accepted|rejected|needs_attention> <reviewer> [note]");
}

run().catch(function (error) {
  process.stderr.write((error?.message || String(error)) + "\n");
  process.exitCode = 1;
});
