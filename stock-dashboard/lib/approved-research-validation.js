const { runDeepSeekResearchNarrative, normalizeAllowedPacketFingerprint } = require("./deepseek-research-narrative");
const { findResearchPacketSnapshotByFingerprint } = require("./research-packet-snapshots");

function isEnabledFlag(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function safeValidationResult(result, snapshot, packetFingerprint) {
  return {
    status: result.status || "failed",
    reason: result.reason || null,
    created: Boolean(result.created),
    marketDate: snapshot.market_date,
    packetFingerprint,
    auditId: result.audit?.id || null,
    validationErrorCount: Array.isArray(result.validationErrors) ? result.validationErrors.length : 0
  };
}

// This runner deliberately has no date or fingerprint input from an HTTP request.
async function runApprovedResearchSnapshotValidation(options = {}) {
  const env = options.env || process.env;
  const packetFingerprint = normalizeAllowedPacketFingerprint(env.DEEPSEEK_ALLOWED_PACKET_FINGERPRINT);
  if (!packetFingerprint) {
    return { status: "skipped", reason: "approved_packet_not_configured", created: false, marketDate: null, packetFingerprint: null, auditId: null, validationErrorCount: 0 };
  }
  if (!isEnabledFlag(env.DEEPSEEK_ONE_TIME_VALIDATION)) {
    return { status: "skipped", reason: "one_time_validation_not_enabled", created: false, marketDate: null, packetFingerprint, auditId: null, validationErrorCount: 0 };
  }

  const snapshot = await (options.findSnapshot || findResearchPacketSnapshotByFingerprint)(
    packetFingerprint,
    options.supabaseConfig,
    options.requestSupabase
  );
  if (!snapshot?.packet || snapshot.packet_fingerprint !== packetFingerprint) {
    return { status: "skipped", reason: "approved_packet_not_found", created: false, marketDate: null, packetFingerprint, auditId: null, validationErrorCount: 0 };
  }

  const result = await (options.runNarrative || runDeepSeekResearchNarrative)(snapshot.packet, {
    env,
    now: options.now,
    runId: "approved-one-time-validation:" + packetFingerprint.slice(0, 12),
    supabaseConfig: options.supabaseConfig,
    requestSupabase: options.requestSupabase
  });
  return safeValidationResult(result, snapshot, packetFingerprint);
}

module.exports = {
  isEnabledFlag,
  runApprovedResearchSnapshotValidation,
  safeValidationResult
};
