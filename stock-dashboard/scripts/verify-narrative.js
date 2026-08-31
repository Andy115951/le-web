/**
 * One-command controlled AI narrative verification.
 *
 * Wraps the multi-step manual flow (generate packet → check completeness →
 * archive snapshot → set gates → call model → close gates) into a single run.
 *
 * The data-egress gate is enabled ONLY inside this process via an ephemeral env
 * object passed to the library. It is never written to .env.local or exported to
 * the global environment, so it "closes" automatically when the process exits.
 *
 * Usage:
 *   node scripts/verify-narrative.js <market-date> [--archive] [--full]
 *
 *   <market-date>  Target New York market date, e.g. 2026-08-14
 *   --archive      Persist a fresh snapshot first (needed when the archived
 *                  snapshot predates a price/derived-data rebuild).
 *   --full         Print the full narrative (headline, recap, claims,
 *                  uncertainties) instead of just the audit status.
 *   --bypass-limit Local testing only: skip the daily request cap and the
 *                  one-time-consumed check so several dates can run in one
 *                  session. Never use on a shared or production run.
 *
 * Requires .env.local to already provide DEEPSEEK_API_KEY / DEEPSEEK_MODEL etc.
 * and DEEPSEEK_RESEARCH_ENABLED=true. The remaining gates are supplied here.
 */
const { normalizeDate } = require("../lib/market-calendar");
const { getDailyResearchPacket } = require("../lib/daily-research-packet");
const {
  getResearchPacketSnapshots,
  persistResearchPacketSnapshot,
  researchPacketFingerprint
} = require("../lib/research-packet-snapshots");
const { runDeepSeekResearchNarrative } = require("../lib/deepseek-research-narrative");
const { getSupabaseConfig } = require("../lib/supabase-server");

function assertPacketComplete(packet, date) {
  const problems = [];
  if (!packet.marketState) problems.push("marketState 为空（QQQ 价格缺失，先补价格并重建派生数据）");
  if (!Array.isArray(packet.events) || packet.events.length === 0) problems.push("events 为空");
  const simCount = packet.historicalSimilarity?.matches?.length ?? 0;
  if (simCount === 0) problems.push("相似日为空（先重建 similar-days）");
  if (problems.length) {
    throw new Error("研究包不完整（" + date + "）：\n  - " + problems.join("\n  - "));
  }
}

function printNarrative(narrative) {
  if (!narrative || typeof narrative !== "object") {
    console.log("(无可读叙述内容)");
    return;
  }
  console.log("\n=== 标题 ===");
  console.log(narrative.headline || narrative.title || "(无)");
  console.log("\n=== 复盘 ===");
  console.log(narrative.recap || narrative.summary || narrative.body || "(无)");
  const claims = Array.isArray(narrative.claims) ? narrative.claims : [];
  if (claims.length) {
    console.log("\n=== 论点与引用 ===");
    claims.forEach(function (claim, index) {
      console.log((index + 1) + ". " + (claim.statement || claim.text || ""));
      if (claim.citations) console.log("   引用: " + JSON.stringify(claim.citations));
    });
  }
  const uncertainties = narrative.uncertainties || narrative.uncertainty;
  if (uncertainties) {
    console.log("\n=== 不确定性 ===");
    console.log(JSON.stringify(uncertainties, null, 2));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const date = normalizeDate(args.find(function (a) { return !a.startsWith("--"); }));
  const doArchive = args.includes("--archive");
  const showFull = args.includes("--full");
  const bypassLimit = args.includes("--bypass-limit");
  const config = getSupabaseConfig();

  // 1. Generate the packet and verify all three pillars are present.
  const packet = await getDailyResearchPacket(date);
  assertPacketComplete(packet, date);
  const fingerprint = researchPacketFingerprint(packet);

  // 2. Ensure an archived snapshot with this exact fingerprint exists.
  if (doArchive) {
    await persistResearchPacketSnapshot(config, packet, packet.generatedAt, {});
  } else {
    const existing = await getResearchPacketSnapshots({ date, includePacket: false, limit: 30 });
    const hasFingerprint = (existing.snapshots || []).some(function (s) {
      return String(s.packet_fingerprint || "").toLowerCase() === fingerprint;
    });
    if (!hasFingerprint) {
      throw new Error(
        "当前指纹 " + fingerprint.slice(0, 16) + "… 无已归档快照。\n" +
        "  加 --archive 先归档一份干净快照再验证。"
      );
    }
  }

  // 3. Enable the data-egress gate ONLY for this process, pinned to this fingerprint.
  const ephemeralEnv = Object.assign({}, process.env, {
    DEEPSEEK_RESEARCH_ENABLED: "true",
    DEEPSEEK_RESEARCH_DATA_APPROVED: "true",
    DEEPSEEK_ALLOWED_PACKET_FINGERPRINT: fingerprint,
    DEEPSEEK_ONE_TIME_VALIDATION: "true"
  });

  // 4. Run the controlled model call.
  const run = await runDeepSeekResearchNarrative(packet, Object.assign({
    runId: "verify-narrative-" + date,
    env: ephemeralEnv
  }, bypassLimit ? {
    // Local testing only: skip the daily cap and one-time-consumed checks so
    // several dates can be verified in one session. Never use on a shared/prod run.
    getAttempts: function () { return Promise.resolve([]); }
  } : {}));

  console.log(JSON.stringify({
    date: date,
    status: run.status,
    reason: run.reason || null,
    created: Boolean(run.created),
    packetFingerprint: run.packetFingerprint || fingerprint,
    auditId: run.audit?.id || null,
    validationErrorCount: Array.isArray(run.validationErrors) ? run.validationErrors.length : 0,
    validationErrors: run.validationErrors || []
  }, null, 2));

  if (showFull && run.audit?.narrative) {
    printNarrative(run.audit.narrative);
  }
  console.log("\n数据出站门控随进程退出自动关闭（未写入 .env.local）。");
}

main().catch(function (error) {
  console.error("verify-narrative 失败: " + (error?.message || String(error)));
  process.exitCode = 1;
});
