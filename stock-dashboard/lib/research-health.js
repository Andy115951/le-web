const { getRecentCaptureRuns } = require("./market-history-capture");
const { isDeepSeekResearchConfigured } = require("./deepseek-research-narrative");
const { countSupabaseRows, getSupabaseConfig } = require("./supabase-server");

function sanitizeRun(run) {
  if (!run) return null;
  return { status: run.status || "unknown", marketDate: run.market_date || null, startedAt: run.started_at || null, finishedAt: run.finished_at || null, durationMs: Number.isFinite(Number(run.duration_ms)) ? Number(run.duration_ms) : null, savedEvents: Number(run.saved_events) || 0 };
}

function buildResearchAlerts(health) {
  const alerts = [];
  const status = health?.latestCapture?.status;
  if (!status) alerts.push({ code: "capture_history_missing", severity: "warning", message: "尚无可用的收盘采集记录。请在下一次收盘后检查 Cron 或用受保护的手动命令重跑。" });
  if (status === "failed") alerts.push({ code: "capture_failed", severity: "error", message: "最近一次收盘采集失败。请使用受保护的运行日志查看安全错误摘要后重跑。" });
  if (status === "partial") alerts.push({ code: "capture_partial", severity: "warning", message: "最近一次采集部分完成。公共数据已保留，但应通过受保护日志复核失败来源。" });
  if (status === "skipped") alerts.push({ code: "capture_skipped", severity: "info", message: "最近任务被跳过，常见原因是未到美股收盘窗口或非交易日。" });
  if (Number(health?.pendingOutcomeCount) > 0) alerts.push({ code: "mature_outcomes_pending", severity: "info", message: "已有研究快照正在等待 20 个交易日结果成熟；成熟后由 Cron 自动追加审计。" });
  if (health?.model?.enabled === false) alerts.push({ code: "model_disabled", severity: "info", message: "模型摘要处于关闭状态；市场研究回放与到期审计仍可正常运行。" });
  return alerts;
}

async function getResearchHealth(options = {}) {
  const config = options.config || getSupabaseConfig();
  const countRows = options.countRows || countSupabaseRows;
  const getRuns = options.getRuns || getRecentCaptureRuns;
  const model = (options.getModelConfig || isDeepSeekResearchConfigured)(options.env || process.env);
  const [runs, snapshotCount, matureOutcomeCount] = await Promise.all([
    getRuns(1),
    countRows(config, "/rest/v1/research_packet_snapshots?select=id"),
    countRows(config, "/rest/v1/research_outcome_evaluations?select=id")
  ]);
  const health = { version: "research-health-v2", latestCapture: sanitizeRun(runs[0]), snapshotCount, matureOutcomeCount, pendingOutcomeCount: Math.max(0, snapshotCount - matureOutcomeCount), model: { enabled: model.enabled, reason: model.enabled ? null : model.reason } };
  return { ...health, alerts: buildResearchAlerts(health) };
}

module.exports = { buildResearchAlerts, getResearchHealth, sanitizeRun };
