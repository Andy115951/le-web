const { getMarketCalendar, getMarketDayDetail } = require("../../lib/market-calendar");
const { getNdxConstituentChangeSummary, getNdxSnapshot } = require("../../lib/ndx-snapshots");
const { getUnifiedMarketEvents } = require("../../lib/unified-market-events");
const { getMarketEventAttributions } = require("../../lib/market-attribution-agent");
const { getStoredDailyFeatures, normalizeFeatureDate } = require("../../lib/daily-feature-store");
const { getNasdaqMarketHistory } = require("../../lib/market-history-capture");
const { getStoredForwardLabels } = require("../../lib/market-label-store");
const { getStoredDailyPrices } = require("../../lib/price-history-store");
const { getStoredSimilarDays } = require("../../lib/similar-day-store");
const { getCurrentMarketScenario } = require("../../lib/current-market-scenario");
const { getDailyResearchPacket } = require("../../lib/daily-research-packet");
const { RESEARCH_NARRATIVE_VERSION, buildResearchNarrativeInstructions } = require("../../lib/research-narrative-contract");
const { getPublishedResearchNarratives } = require("../../lib/research-narrative-audit");
const { getEventReviewQueue } = require("../../lib/event-review");
const { getResearchPacketSnapshots } = require("../../lib/research-packet-snapshots");
const { getWalkForwardSplitManifest } = require("../../lib/evaluation-split-manifest");
const { getBaselineEvaluationReport } = require("../../lib/evaluation-baseline-report");
const { getLogisticEvaluationReport } = require("../../lib/evaluation-logistic-report");
const { getTreeEvaluationReport } = require("../../lib/evaluation-tree-report");
const { getWalkForwardBacktestReport } = require("../../lib/evaluation-backtest-report");
const { getResearchOutcomeEvaluations } = require("../../lib/research-outcome-evaluations");
const { getSupabaseConfig } = require("../../lib/supabase-server");
const { getResearchHealth } = require("../../lib/research-health");
const { getDailyResearchReports } = require("../../lib/daily-research-reports");
const { getWeeklyResearchReports } = require("../../lib/weekly-research-reports");
const { getResearchTaskRuns } = require("../../lib/research-task-runs");
const { getResearchQuality } = require("../../lib/research-quality");
const { getResearchFlowReplay } = require("../../lib/research-flow-replay");
const { getCandidatePromotionReviews, getLogisticPromotionReview, getTreePromotionReview } = require("../../lib/evaluation-promotion-report");

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function sendMethodNotAllowed(res) {
  res.setHeader("Allow", "GET");
  sendJson(res, 405, { error: "Method not allowed" });
}

function sendInvalidQuery(res, error) {
  res.setHeader("Cache-Control", "no-store");
  sendJson(res, 400, { ok: false, error });
}

function sendFailure(res, message, error) {
  console.error(message, error);
  res.setHeader("Cache-Control", "no-store");
  sendJson(res, 500, { ok: false, error: message });
}

const resources = {
  async "research-flow"(req, res) {
    try {
      const flow = await getResearchFlowReplay({ snapshotId: req.query?.snapshotId }, getSupabaseConfig());
      if (!flow) {
        sendJson(res, 404, { ok: false, error: "Research snapshot was not found" });
        return;
      }
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
      sendJson(res, 200, { ok: true, researchOnly: true, flow });
    } catch (error) {
      if (/Invalid research snapshot id/.test(error?.message || "")) {
        sendInvalidQuery(res, "Invalid research snapshot id");
        return;
      }
      sendFailure(res, "Failed to load research flow replay", error);
    }
  },
  async "research-quality"(_req, res) {
    try {
      const quality = await getResearchQuality({ config: getSupabaseConfig() });
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
      sendJson(res, 200, { ok: true, researchOnly: true, quality });
    } catch (error) { sendFailure(res, "Failed to load research quality coverage", error); }
  },
  async "research-health"(_req, res) {
    try {
      const health = await getResearchHealth();
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
      sendJson(res, 200, { ok: true, researchOnly: true, health });
    } catch (error) { sendFailure(res, "Failed to load research health", error); }
  },
  async "daily-reports"(req, res) {
    try {
      const result = await getDailyResearchReports({ limit: req.query?.limit }, getSupabaseConfig());
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
      sendJson(res, 200, { ok: true, researchOnly: true, ...result });
    } catch (error) { sendFailure(res, "Failed to load daily research reports", error); }
  },
  async "weekly-reports"(req, res) {
    try {
      const result = await getWeeklyResearchReports({ limit: req.query?.limit }, getSupabaseConfig());
      res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
      sendJson(res, 200, { ok: true, researchOnly: true, ...result });
    } catch (error) { sendFailure(res, "Failed to load weekly research reports", error); }
  },
  async "research-tasks"(req, res) {
    try {
      const result = await getResearchTaskRuns({ limit: req.query?.limit }, getSupabaseConfig());
      res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
      sendJson(res, 200, { ok: true, researchOnly: true, ...result });
    } catch (error) { sendFailure(res, "Failed to load research task runs", error); }
  },
  async calendar(req, res) {
    try {
      const date = String(req.query?.date || "").trim();
      const result = date ? await getMarketDayDetail(date) : await getMarketCalendar(req.query?.month);
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800");
      sendJson(res, 200, { ok: true, mode: date ? "day" : "month", ...result });
    } catch (error) {
      if (/Invalid calendar/.test(error?.message || "")) {
        sendInvalidQuery(res, error.message);
        return;
      }
      sendFailure(res, "Failed to load market calendar", error);
    }
  },

  async constituents(req, res) {
    try {
      const snapshot = await getNdxSnapshot(req.query?.asOf);
      if (!snapshot) {
        sendJson(res, 404, { ok: false, error: "No NDX snapshot available for the requested date" });
        return;
      }
      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
      sendJson(res, 200, { ok: true, snapshot });
    } catch (error) {
      if (/Invalid as-of date/.test(error?.message || "")) {
        sendInvalidQuery(res, "Invalid asOf date; expected YYYY-MM-DD");
        return;
      }
      sendFailure(res, "Failed to load NDX constituents", error);
    }
  },

  async "constituent-changes"(req, res) {
    try {
      const snapshot = await getNdxSnapshot(req.query?.asOf);
      const result = await getNdxConstituentChangeSummary(snapshot);
      const requestedLimit = Number(req.query?.limit);
      const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 50) : 12;
      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
      sendJson(res, 200, {
        ok: true,
        asOf: snapshot?.asOf || null,
        result: { ...result, changes: result.changes.slice(0, limit) }
      });
    } catch (error) {
      if (/Invalid as-of date/.test(error?.message || "")) {
        sendInvalidQuery(res, "Invalid asOf date; expected YYYY-MM-DD");
        return;
      }
      sendFailure(res, "Failed to load NDX constituent changes", error);
    }
  },

  async events(req, res) {
    try {
      const events = await getUnifiedMarketEvents(req.query?.days);
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
      sendJson(res, 200, { ok: true, count: events.length, events });
    } catch (error) {
      sendFailure(res, "Failed to load unified market events", error);
    }
  },

  async attributions(req, res) {
    try {
      const result = await getMarketEventAttributions({ marketDate: req.query?.date, limit: req.query?.limit }, getSupabaseConfig());
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
      sendJson(res, 200, { ok: true, researchOnly: true, ...result });
    } catch (error) {
      if (/Invalid attribution market date/.test(error?.message || "")) {
        sendInvalidQuery(res, "Invalid attribution date; expected YYYY-MM-DD");
        return;
      }
      sendFailure(res, "Failed to load market event attributions", error);
    }
  },

  async features(req, res) {
    try {
      const result = await getStoredDailyFeatures(req.query?.symbol || "QQQ", req.query?.limit, normalizeFeatureDate(req.query?.date));
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
      sendJson(res, 200, {
        ok: true,
        timezone: "America/New_York",
        instrument: result.instrument,
        count: result.features.length,
        features: result.features
      });
    } catch (error) {
      if (/Invalid feature date|Unsupported market symbol|Instrument is not registered/.test(error?.message || "")) {
        sendInvalidQuery(res, "Invalid feature query");
        return;
      }
      sendFailure(res, "Failed to load daily market features", error);
    }
  },

  async history(req, res) {
    try {
      const history = await getNasdaqMarketHistory(req.query?.days);
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
      sendJson(res, 200, { ok: true, count: history.length, history });
    } catch (error) {
      sendFailure(res, "Failed to load Nasdaq history", error);
    }
  },

  async labels(req, res) {
    try {
      const result = await getStoredForwardLabels(req.query?.symbol || "QQQ", req.query?.limit);
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
      sendJson(res, 200, {
        ok: true,
        researchOnly: true,
        instrument: result.instrument,
        count: result.labels.length,
        labels: result.labels
      });
    } catch (error) {
      if (/Unsupported market symbol|Instrument is not registered/.test(error?.message || "")) {
        sendInvalidQuery(res, "Unsupported market symbol");
        return;
      }
      sendFailure(res, "Failed to load forward labels", error);
    }
  },

  async prices(req, res) {
    try {
      const result = await getStoredDailyPrices(req.query?.symbol || "QQQ", req.query?.limit);
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
      sendJson(res, 200, {
        ok: true,
        instrument: result.instrument,
        count: result.prices.length,
        prices: result.prices
      });
    } catch (error) {
      if (/Unsupported market symbol|Instrument is not registered/.test(error?.message || "")) {
        sendInvalidQuery(res, "Unsupported market symbol");
        return;
      }
      sendFailure(res, "Failed to load daily prices", error);
    }
  },

  async "similar-days"(req, res) {
    try {
      const result = await getStoredSimilarDays(req.query?.symbol || "QQQ", req.query?.date, req.query?.limit);
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
      sendJson(res, 200, {
        ok: true,
        researchOnly: true,
        timezone: "America/New_York",
        instrument: result.instrument,
        target: result.target,
        count: result.matches.length,
        summary: result.summary,
        methodVersion: result.methodVersion,
        matches: result.matches
      });
    } catch (error) {
      if (/Invalid feature date|Unsupported market symbol|Instrument is not registered/.test(error?.message || "")) {
        sendInvalidQuery(res, "Invalid similar-day query");
        return;
      }
      sendFailure(res, "Failed to load similar days", error);
    }
  },

  async "current-scenario"(_req, res) {
    try {
      const scenario = await getCurrentMarketScenario();
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
      sendJson(res, 200, { ok: true, researchOnly: true, scenario });
    } catch (error) {
      sendFailure(res, "Failed to load current empirical market scenario", error);
    }
  },

  async "research-packet"(req, res) {
    try {
      const packet = await getDailyResearchPacket(req.query?.date);
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
      sendJson(res, 200, { ok: true, packet });
    } catch (error) {
      if (/Invalid calendar date/.test(error?.message || "")) {
        sendInvalidQuery(res, "Invalid research packet date; expected YYYY-MM-DD");
        return;
      }
      sendFailure(res, "Failed to build daily research packet", error);
    }
  },

  async "research-narrative-contract"(req, res) {
    try {
      const packet = await getDailyResearchPacket(req.query?.date);
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
      sendJson(res, 200, {
        ok: true,
        researchOnly: true,
        packetContractVersion: packet.contractVersion,
        narrativeContractVersion: RESEARCH_NARRATIVE_VERSION,
        instructions: buildResearchNarrativeInstructions(packet)
      });
    } catch (error) {
      if (/Invalid calendar date/.test(error?.message || "")) {
        sendInvalidQuery(res, "Invalid narrative contract date; expected YYYY-MM-DD");
        return;
      }
      sendFailure(res, "Failed to build research narrative contract", error);
    }
  },

  async "research-narratives"(req, res) {
    try {
      const result = await getPublishedResearchNarratives({
        date: req.query?.date,
        limit: req.query?.limit
      });
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
      sendJson(res, 200, { ok: true, researchOnly: true, ...result });
    } catch (error) {
      if (/Invalid calendar date/.test(error?.message || "")) {
        sendInvalidQuery(res, "Invalid research narrative date; expected YYYY-MM-DD");
        return;
      }
      sendFailure(res, "Failed to load published research narratives", error);
    }
  },

  async "review-queue"(req, res) {
    try {
      const queue = await getEventReviewQueue(req.query?.days);
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
      sendJson(res, 200, { ok: true, researchOnly: true, ...queue });
    } catch (error) {
      sendFailure(res, "Failed to load event review queue", error);
    }
  },

  async "research-packet-snapshots"(req, res) {
    try {
      const result = await getResearchPacketSnapshots({
        date: req.query?.date,
        limit: req.query?.limit,
        includePacket: req.query?.includePacket
      });
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
      sendJson(res, 200, { ok: true, researchOnly: true, ...result });
    } catch (error) {
      if (/Invalid calendar date/.test(error?.message || "")) {
        sendInvalidQuery(res, "Invalid research packet snapshot date; expected YYYY-MM-DD");
        return;
      }
      sendFailure(res, "Failed to load research packet snapshots", error);
    }
  },

  async "evaluation-splits"(_req, res) {
    try {
      const manifest = getWalkForwardSplitManifest();
      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
      sendJson(res, 200, { ok: true, researchOnly: true, manifest });
    } catch (error) {
      sendFailure(res, "Failed to load frozen evaluation splits", error);
    }
  },

  async "evaluation-baselines"(_req, res) {
    try {
      const report = getBaselineEvaluationReport();
      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
      sendJson(res, 200, { ok: true, researchOnly: true, report });
    } catch (error) {
      sendFailure(res, "Failed to load frozen baseline evaluation", error);
    }
  },

  async "evaluation-logistic"(_req, res) {
    try {
      const report = getLogisticEvaluationReport();
      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
      sendJson(res, 200, { ok: true, researchOnly: true, report });
    } catch (error) {
      sendFailure(res, "Failed to load frozen logistic evaluation", error);
    }
  },

  async "evaluation-logistic-review"(_req, res) {
    try {
      const review = getLogisticPromotionReview();
      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
      sendJson(res, 200, { ok: true, researchOnly: true, review });
    } catch (error) {
      sendFailure(res, "Failed to load logistic promotion review", error);
    }
  },

  async "evaluation-tree"(_req, res) {
    try {
      const report = getTreeEvaluationReport();
      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
      sendJson(res, 200, { ok: true, researchOnly: true, report });
    } catch (error) {
      sendFailure(res, "Failed to load frozen tree evaluation", error);
    }
  },

  async "evaluation-tree-review"(_req, res) {
    try {
      const review = getTreePromotionReview();
      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
      sendJson(res, 200, { ok: true, researchOnly: true, review });
    } catch (error) {
      sendFailure(res, "Failed to load tree promotion review", error);
    }
  },

  async "evaluation-candidate-reviews"(_req, res) {
    try {
      const candidates = getCandidatePromotionReviews();
      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
      sendJson(res, 200, { ok: true, researchOnly: true, candidates });
    } catch (error) {
      sendFailure(res, "Failed to load candidate promotion reviews", error);
    }
  },

  async "evaluation-backtest"(_req, res) {
    try {
      const report = getWalkForwardBacktestReport();
      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
      sendJson(res, 200, { ok: true, researchOnly: true, report });
    } catch (error) {
      sendFailure(res, "Failed to load frozen walk-forward backtest", error);
    }
  },

  async "research-outcomes"(req, res) {
    try {
      const result = await getResearchOutcomeEvaluations({ limit: req.query?.limit }, getSupabaseConfig());
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
      sendJson(res, 200, { ok: true, researchOnly: true, ...result });
    } catch (error) {
      sendFailure(res, "Failed to load mature research outcomes", error);
    }
  }
};

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    sendMethodNotAllowed(res);
    return;
  }

  const resource = Array.isArray(req.query?.resource) ? req.query.resource[0] : req.query?.resource;
  const resourceHandler = resources[resource];
  if (!resourceHandler) {
    sendJson(res, 404, { ok: false, error: "Unknown Nasdaq resource" });
    return;
  }
  await resourceHandler(req, res);
};
