export const DECISION_LOG_VERSION = "decision-log-v3";
export const DECISION_LOG_MAX = 500;
export const DECISION_LOG_ACTIONS = new Set(["bought", "added", "trimmed", "sold", "hold", "watch", "skip"]);
export const DECISION_LOG_OUTCOMES = new Set(["pending", "worked", "mixed", "wrong"]);
const HOLDING_TYPES = new Set(["watchlist", "core", "trading"]);

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validMarketDate(value) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(date + "T12:00:00.000Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}

function validTimestamp(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp).toISOString() : null;
}

function cleanText(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function fixedPositive(value, decimals) {
  const number = finite(value);
  return number !== null && number > 0 ? Number(number.toFixed(decimals)) : null;
}

function fixedNumber(value, decimals) {
  const number = finite(value);
  return number === null ? null : Number(number.toFixed(decimals));
}

// Snapshots are deliberately small and private: they preserve only the user's
// context at the moment a decision or outcome was recorded. They never fetch or
// infer historical prices for earlier logs.
function normalizeDecisionSnapshot(input) {
  const source = input && typeof input === "object" ? input : {};
  const capturedAt = validTimestamp(source.capturedAt);
  if (!capturedAt) return null;
  const snapshot = {
    capturedAt,
    marketDate: validMarketDate(source.marketDate),
    price: fixedPositive(source.price, 4),
    changePercent: fixedNumber(source.changePercent, 3),
    peakPrice: fixedPositive(source.peakPrice, 4),
    peakAt: validTimestamp(source.peakAt),
    targetPrice: fixedPositive(source.targetPrice, 4),
    costBasis: fixedPositive(source.costBasis, 4),
    shares: fixedPositive(source.shares, 4),
    holdingType: HOLDING_TYPES.has(source.holdingType) ? source.holdingType : null
  };
  const hasContext = ["price", "changePercent", "peakPrice", "targetPrice", "costBasis", "shares", "holdingType"].some(function (key) {
    return snapshot[key] !== null;
  });
  return hasContext ? snapshot : null;
}

// 决策日志由用户手写，允许后续编辑，因此 id 必须在编辑之间保持稳定。
// 优先保留传入的 id；仅在缺失时用 createdAt + symbol 派生一个稳定 id。
function resolveId(input, createdAt, symbol) {
  const provided = cleanText(input.id, 200);
  if (provided) return provided;
  return "decision:" + createdAt + ":" + symbol;
}

export function createDecisionLog(input = {}) {
  const deletedAt = validTimestamp(input.deletedAt);
  if (deletedAt) {
    const id = cleanText(input.id, 200);
    const createdAt = validTimestamp(input.createdAt) || validTimestamp(input.updatedAt);
    if (!id || !createdAt) return null;
    const priorUpdatedAt = validTimestamp(input.updatedAt) || createdAt;
    return {
      id,
      version: DECISION_LOG_VERSION,
      createdAt,
      updatedAt: new Date(deletedAt).getTime() > new Date(priorUpdatedAt).getTime() ? deletedAt : priorUpdatedAt,
      deletedAt
    };
  }
  const marketDate = validMarketDate(input.marketDate);
  const symbol = cleanText(input.symbol, 24).toUpperCase();
  const action = cleanText(input.action, 24);
  if (!marketDate || !symbol || !DECISION_LOG_ACTIONS.has(action)) return null;

  const createdAt = validTimestamp(input.createdAt) || validTimestamp(input.updatedAt);
  if (!createdAt) return null;
  // updatedAt 用于 last-write-wins 合并；缺失时回退到 createdAt。
  const updatedAt = validTimestamp(input.updatedAt) || createdAt;

  const rationale = cleanText(input.rationale, 600);
  const linkedObservationId = cleanText(input.linkedObservationId, 200) || null;

  const rawOutcome = cleanText(input.outcome, 24);
  const outcome = DECISION_LOG_OUTCOMES.has(rawOutcome) ? rawOutcome : "pending";
  const outcomeNote = cleanText(input.outcomeNote, 600);
  const outcomeRecordedAt = outcome === "pending" ? null : validTimestamp(input.outcomeRecordedAt);

  return {
    id: resolveId(input, createdAt, symbol),
    version: DECISION_LOG_VERSION,
    createdAt,
    updatedAt,
    marketDate,
    symbol,
    displayName: cleanText(input.displayName, 120) || symbol,
    action,
    rationale,
    linkedObservationId,
    outcome,
    outcomeNote,
    outcomeRecordedAt,
    snapshot: normalizeDecisionSnapshot(input.snapshot),
    outcomeSnapshot: outcome === "pending" ? null : normalizeDecisionSnapshot(input.outcomeSnapshot),
    deletedAt: null
  };
}

export function normalizeDecisionLogs(logs) {
  const latest = new Map();
  (Array.isArray(logs) ? logs : []).forEach(function (entry) {
    const normalized = createDecisionLog(entry);
    if (!normalized) return;
    const current = latest.get(normalized.id);
    // 同 id 保留更新更晚的一条；同一时刻删除优先，防止旧设备复活已删除记录。
    const isNewer = !current || new Date(normalized.updatedAt).getTime() > new Date(current.updatedAt).getTime();
    const deleteWinsTie = current && new Date(normalized.updatedAt).getTime() === new Date(current.updatedAt).getTime()
      && normalized.deletedAt && !current.deletedAt;
    if (isNewer || deleteWinsTie) {
      latest.set(normalized.id, normalized);
    }
  });
  const sorted = Array.from(latest.values()).sort(function (left, right) {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      || left.id.localeCompare(right.id);
  });
  const active = sorted.filter(function (entry) { return !entry.deletedAt; }).slice(0, DECISION_LOG_MAX);
  // Tombstones remain deliberately uncapped: pruning one would let a very old
  // offline device restore that record during a later last-write-wins merge.
  const tombstones = sorted.filter(function (entry) { return entry.deletedAt; });
  return active.concat(tombstones);
}

// 与 personal-observations 的 first-write-wins 相反：决策日志是用户可编辑内容，
// 跨设备同步时应让最新一次编辑（updatedAt 更大者）覆盖旧值。
export function mergeDecisionLogs(existing, incoming) {
  const combined = (Array.isArray(existing) ? existing : []).concat(Array.isArray(incoming) ? incoming : []);
  return normalizeDecisionLogs(combined);
}

export function getActiveDecisionLogs(logs) {
  return normalizeDecisionLogs(logs).filter(function (entry) { return !entry.deletedAt; });
}

export function needsDecisionLogWriteBack(remoteLogs, mergedLogs) {
  return JSON.stringify(normalizeDecisionLogs(remoteLogs)) !== JSON.stringify(normalizeDecisionLogs(mergedLogs));
}

// Deleted entries are retained as minimal tombstones so an offline device with
// an older copy cannot restore a record after its next cloud sync.
export function deleteDecisionLog(entry, now = new Date()) {
  const base = createDecisionLog(entry);
  const deletedAt = validTimestamp(now) || validTimestamp(Date.now());
  if (!base || base.deletedAt || !deletedAt) return null;
  return createDecisionLog({
    id: base.id,
    createdAt: base.createdAt,
    updatedAt: deletedAt,
    deletedAt
  });
}

export function applyOutcome(entry, patch = {}) {
  const base = createDecisionLog(entry);
  if (!base || base.deletedAt) return null;
  const rawOutcome = cleanText(patch.outcome, 24);
  const outcome = DECISION_LOG_OUTCOMES.has(rawOutcome) ? rawOutcome : base.outcome;
  const now = validTimestamp(patch.now) || validTimestamp(Date.now());
  return createDecisionLog({
    ...base,
    outcome,
    outcomeNote: patch.outcomeNote != null ? patch.outcomeNote : base.outcomeNote,
    outcomeRecordedAt: outcome === "pending" ? null : now,
    outcomeSnapshot: outcome === "pending" ? null : (patch.outcomeSnapshot != null ? patch.outcomeSnapshot : base.outcomeSnapshot),
    updatedAt: now
  });
}
