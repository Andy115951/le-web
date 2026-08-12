const { getRecentCaptureRuns } = require("./market-history-capture");
const { getResearchPacketSnapshots } = require("./research-packet-snapshots");
const { getResearchOutcomeEvaluations } = require("./research-outcome-evaluations");
const { isDeepSeekResearchConfigured } = require("./deepseek-research-narrative");

function sanitizeRun(run) {
  if (!run) return null;
  return { status: run.status || "unknown", marketDate: run.market_date || null, startedAt: run.started_at || null, finishedAt: run.finished_at || null, durationMs: Number.isFinite(Number(run.duration_ms)) ? Number(run.duration_ms) : null, savedEvents: Number(run.saved_events) || 0 };
}

async function getResearchHealth() {
  const [runs, snapshots, outcomes] = await Promise.all([getRecentCaptureRuns(1), getResearchPacketSnapshots({ limit: 30 }), getResearchOutcomeEvaluations({ limit: 30 }, require("./supabase-server").getSupabaseConfig())]);
  const model = isDeepSeekResearchConfigured();
  return { version: "research-health-v1", latestCapture: sanitizeRun(runs[0]), snapshotCount: snapshots.count, matureOutcomeCount: outcomes.count, pendingOutcomeCount: Math.max(0, snapshots.count - outcomes.count), model: { enabled: model.enabled, reason: model.enabled ? null : model.reason } };
}

module.exports = { getResearchHealth, sanitizeRun };
