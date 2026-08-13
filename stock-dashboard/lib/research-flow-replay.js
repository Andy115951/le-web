const { getSupabaseConfig, requestSupabase } = require("./supabase-server");

const RESEARCH_FLOW_REPLAY_VERSION = "research-flow-replay-v3";

function normalizeSnapshotId(value) {
  const id = String(value || "").trim();
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) {
    throw new Error("Invalid research snapshot id");
  }
  return id;
}

function stage(status, details) {
  return { status, ...details };
}

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0;
}

function boolean(value) {
  return value === true;
}

function summarizeCaptureTaskDetails(kind, details) {
  const source = details && typeof details === "object" ? details : {};
  if (kind === "market_collection") {
    return {
      publicRowsWritten: finiteNonNegative(source.publicRowsWritten),
      unifiedEventsWritten: finiteNonNegative(source.unifiedEventsWritten),
      unifiedSourcesWritten: finiteNonNegative(source.unifiedSourcesWritten),
      failedSymbolCount: finiteNonNegative(source.failedSymbolCount)
    };
  }
  if (kind === "event_attribution") {
    return {
      deterministicAttributions: finiteNonNegative(source.deterministicAttributions),
      heuristicAttributionCount: finiteNonNegative(source.heuristicAttributionCount),
      primarySourcesLinked: finiteNonNegative(source.primarySourcesLinked),
      evidenceSourcesLinked: finiteNonNegative(source.evidenceSourcesLinked)
    };
  }
  if (["research_input_snapshot", "daily_fact_report", "model_recap"].includes(kind)) {
    return { created: boolean(source.created) };
  }
  if (kind === "weekly_fact_report") {
    const calendarStatus = ["official_full_closures", "strict_weekday_fallback"].includes(source.calendarStatus)
      ? source.calendarStatus
      : "unknown";
    return {
      created: boolean(source.created),
      expectedBusinessDateCount: finiteNonNegative(source.expectedBusinessDateCount),
      archivedDailyReportCount: finiteNonNegative(source.archivedDailyReportCount),
      calendarStatus
    };
  }
  if (kind === "outcome_evaluation") return { matureOutcomesWritten: finiteNonNegative(source.matureOutcomesWritten) };
  return {};
}

function summarizeCaptureTasks(runs) {
  const latest = new Map();
  (Array.isArray(runs) ? runs : []).forEach(function (run) {
    const kind = String(run?.task_kind || "").trim();
    if (!kind || latest.has(kind)) return;
    latest.set(kind, {
      status: String(run.status || "unknown"),
      taskVersion: run.task_version || null,
      createdAt: run.created_at || null,
      details: summarizeCaptureTaskDetails(kind, run.details)
    });
  });
  return Object.fromEntries(latest);
}

function buildResearchFlowReplay(input) {
  const snapshot = input?.snapshot || null;
  if (!snapshot) return null;
  const safeSnapshot = { ...snapshot };
  delete safeSnapshot.capture_run_id;
  const dailyReports = Array.isArray(input?.dailyReports) ? input.dailyReports : [];
  const narrativeAudits = Array.isArray(input?.narrativeAttempts) ? input.narrativeAttempts : (Array.isArray(input?.narrativeAudits) ? input.narrativeAudits : []);
  const outcomeEvaluations = Array.isArray(input?.outcomeEvaluations) ? input.outcomeEvaluations : [];
  const captureTasks = Array.isArray(input?.captureTasks) ? input.captureTasks : [];
  const acceptedNarratives = Array.isArray(input?.narratives) ? input.narratives : narrativeAudits.filter(function (audit) { return audit?.status === "accepted"; });
  const rejectedNarrativeCount = narrativeAudits.filter(function (audit) { return audit?.status === "rejected"; }).length;
  const latestDailyReport = dailyReports[0] || null;
  const latestOutcome = outcomeEvaluations[0] || null;
  return {
    version: RESEARCH_FLOW_REPLAY_VERSION,
    snapshot: safeSnapshot,
    stages: {
      captureRun: snapshot.capture_run_id
        ? stage("linked", { taskCount: captureTasks.length, tasks: summarizeCaptureTasks(captureTasks) })
        : stage("not_linked", { reason: "This historical snapshot has no stored capture-run association." }),
      inputArchive: stage("archived", {
        capturedAt: snapshot.captured_at || null,
        packetContractVersion: snapshot.packet_contract_version || null
      }),
      dailyFactReport: latestDailyReport
        ? stage("archived", { reportVersion: latestDailyReport.report_version || null, createdAt: latestDailyReport.created_at || null, report: latestDailyReport.report || null })
        : stage("not_archived", { reason: "No daily fact report has been archived for this exact snapshot." }),
      modelNarrative: acceptedNarratives.length
        ? stage("accepted", { acceptedCount: acceptedNarratives.length, rejectedCount: rejectedNarrativeCount, narratives: acceptedNarratives })
        : rejectedNarrativeCount
          ? stage("rejected", { acceptedCount: 0, rejectedCount: rejectedNarrativeCount })
          : stage("not_generated", { acceptedCount: 0, rejectedCount: 0 }),
      outcomeEvaluation: latestOutcome
        ? stage("evaluated", { evaluation: latestOutcome })
        : stage("not_archived", { reason: "No completed 20-trading-day outcome audit has been archived for this exact snapshot." })
    }
  };
}

async function getResearchFlowReplay(options = {}, config = getSupabaseConfig(), requestImpl = requestSupabase) {
  const snapshotId = normalizeSnapshotId(options.snapshotId);
  const snapshotRows = await requestImpl(
    config,
    "/rest/v1/research_packet_snapshots?select=id,market_date,packet_contract_version,packet_fingerprint,packet,source_summary,captured_at,created_at,capture_run_id&id=eq." + encodeURIComponent(snapshotId) + "&limit=1"
  );
  const snapshot = Array.isArray(snapshotRows) ? snapshotRows[0] || null : null;
  if (!snapshot) return null;
  const [dailyReports, narrativeAttempts, narratives, outcomeEvaluations, captureTasks] = await Promise.all([
    requestImpl(config, "/rest/v1/daily_research_reports?select=report_version,report,created_at&snapshot_id=eq." + encodeURIComponent(snapshot.id) + "&order=created_at.desc&limit=5"),
    requestImpl(config, "/rest/v1/research_narrative_audits?select=status,provider,model,created_at&packet_fingerprint=eq." + encodeURIComponent(snapshot.packet_fingerprint) + "&order=created_at.desc&limit=10"),
    requestImpl(config, "/rest/v1/research_narrative_audits?select=status,provider,model,narrative,created_at&status=eq.accepted&packet_fingerprint=eq." + encodeURIComponent(snapshot.packet_fingerprint) + "&order=created_at.desc&limit=5"),
    requestImpl(config, "/rest/v1/research_outcome_evaluations?select=evaluation_version,horizon_trading_days,label_version,realized_return_percent,maximum_drawdown_percent,realized_volatility_percent,evaluated_at,created_at&snapshot_id=eq." + encodeURIComponent(snapshot.id) + "&order=evaluated_at.desc,created_at.desc&limit=5"),
    snapshot.capture_run_id
      ? requestImpl(config, "/rest/v1/research_task_runs?select=task_kind,task_version,status,details,created_at&capture_run_id=eq." + encodeURIComponent(snapshot.capture_run_id) + "&order=created_at.desc&limit=20")
      : Promise.resolve([])
  ]);
  return buildResearchFlowReplay({ snapshot, dailyReports, narrativeAttempts, narratives, outcomeEvaluations, captureTasks });
}

module.exports = {
  RESEARCH_FLOW_REPLAY_VERSION,
  buildResearchFlowReplay,
  getResearchFlowReplay,
  normalizeSnapshotId,
  summarizeCaptureTaskDetails,
  summarizeCaptureTasks
};
