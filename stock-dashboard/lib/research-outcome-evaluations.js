const { getStoredForwardLabels } = require("./market-label-store");
const { requestSupabase } = require("./supabase-server");

const RESEARCH_OUTCOME_EVALUATION_VERSION = "research-outcome-20d-v1";
const HORIZON_TRADING_DAYS = 20;

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildOutcomeRows(snapshots, labels, evaluatedAt = new Date().toISOString(), evaluatedSnapshotIds = new Set()) {
  const labelsByDate = new Map((Array.isArray(labels) ? labels : []).map(function (label) { return [label.market_date, label]; }));
  return (Array.isArray(snapshots) ? snapshots : []).flatMap(function (snapshot) {
    if (!snapshot?.id || evaluatedSnapshotIds.has(snapshot.id)) return [];
    const label = labelsByDate.get(snapshot.market_date);
    const realizedReturn = finite(label?.return_20d_percent);
    if (realizedReturn === null) return [];
    return [{ snapshot_id: snapshot.id, market_date: snapshot.market_date, evaluation_version: RESEARCH_OUTCOME_EVALUATION_VERSION, horizon_trading_days: HORIZON_TRADING_DAYS, label_version: String(label.label_version || "unknown"), realized_return_percent: realizedReturn, maximum_drawdown_percent: finite(label.max_drawdown_20d_percent), realized_volatility_percent: finite(label.realized_volatility_20d_percent), evaluated_at: new Date(evaluatedAt).toISOString() }];
  });
}

async function evaluateMatureResearchOutcomes(config, options = {}) {
  const request = options.requestImpl || requestSupabase;
  const evaluatedAt = options.evaluatedAt || new Date().toISOString();
  const snapshots = await request(config, "/rest/v1/research_packet_snapshots?select=id,market_date&order=market_date.asc&limit=1000");
  const existing = await request(config, "/rest/v1/research_outcome_evaluations?select=snapshot_id&evaluation_version=eq." + encodeURIComponent(RESEARCH_OUTCOME_EVALUATION_VERSION) + "&limit=1000");
  const labelData = await getStoredForwardLabels("QQQ", 2600);
  const rows = buildOutcomeRows(snapshots, labelData.labels, evaluatedAt, new Set((Array.isArray(existing) ? existing : []).map(function (row) { return row.snapshot_id; })));
  if (rows.length) await request(config, "/rest/v1/research_outcome_evaluations?on_conflict=snapshot_id,evaluation_version", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: rows });
  return { evaluationVersion: RESEARCH_OUTCOME_EVALUATION_VERSION, snapshotsScanned: Array.isArray(snapshots) ? snapshots.length : 0, existingEvaluations: Array.isArray(existing) ? existing.length : 0, matureOutcomesWritten: rows.length };
}

module.exports = { HORIZON_TRADING_DAYS, RESEARCH_OUTCOME_EVALUATION_VERSION, buildOutcomeRows, evaluateMatureResearchOutcomes };
