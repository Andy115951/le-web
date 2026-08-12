const crypto = require("crypto");
const { getDailyMarketEvents, isAfterUsMarketClose, marketDate } = require("./daily-market-events");

const RUNS_TABLE = "market_capture_runs";

function getConfig() {
  const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const secretKey = String(process.env.SUPABASE_SECRET_KEY || "").trim();
  if (!url || !secretKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY");
  }
  return { url, secretKey };
}

async function requestSupabase(config, path, options) {
  const response = await fetch(config.url + path, {
    method: options?.method || "GET",
    headers: {
      // New sb_secret_ keys are opaque API keys, not JWT bearer tokens.
      apikey: config.secretKey,
      "Content-Type": "application/json",
      ...(options?.headers || {})
    },
    body: options?.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  if (!response.ok) throw new Error("Supabase " + response.status + ": " + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}

function isGlobalStockSymbol(symbol) {
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(String(symbol || "").trim().toUpperCase());
}

function collectSymbols(items) {
  return Array.from(new Set((Array.isArray(items) ? items : []).map(function (item) {
    return String(item?.symbol || "").trim().toUpperCase();
  }).filter(isGlobalStockSymbol))).sort();
}

function toHistoryRow(userId, event, now) {
  return {
    user_id: userId,
    market_date: event.date,
    symbol: event.symbol,
    display_name: event.name,
    change_percent: event.changePercent,
    benchmark_change_percent: event.benchmarkChangePercent,
    driver_type: event.driverType,
    confidence: event.confidence,
    summary: event.summary,
    reasons: Array.isArray(event.reasons) ? event.reasons : [],
    news: Array.isArray(event.news) ? event.news : [],
    captured_at: event.capturedAt,
    updated_at: now.toISOString()
  };
}

function normalizeCaptureOptions(input) {
  if (input instanceof Date) return { now: input, trigger: "manual" };
  const options = input && typeof input === "object" ? input : {};
  return {
    now: options.now instanceof Date ? options.now : new Date(),
    trigger: options.trigger === "manual" ? "manual" : "cron"
  };
}

function errorMessage(error) {
  return String(error?.message || error || "Unknown capture error").slice(0, 500);
}

function determineRunStatus(processedUsers, skippedUsers, failedUsers) {
  if (failedUsers <= 0) return processedUsers > 0 ? "succeeded" : "skipped";
  return processedUsers > 0 || skippedUsers > 0 ? "partial" : "failed";
}

async function createRun(config, run) {
  await requestSupabase(config, "/rest/v1/" + RUNS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: run
  });
}

async function updateRun(config, runId, patch) {
  await requestSupabase(config, "/rest/v1/" + RUNS_TABLE + "?id=eq." + encodeURIComponent(runId), {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: patch
  });
}

async function safelyUpdateRun(config, runId, patch) {
  try {
    await updateRun(config, runId, patch);
    return null;
  } catch (error) {
    return errorMessage(error);
  }
}

function finalRunPatch(startedAt, result, status, details, error) {
  const finishedAt = new Date();
  return {
    status,
    market_date: result?.date || null,
    finished_at: finishedAt.toISOString(),
    duration_ms: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
    source_users: Number(result?.sourceUsers || 0),
    processed_users: Number(result?.processedUsers || 0),
    saved_events: Number(result?.savedEvents || 0),
    skipped_users: Number(result?.skippedUsers || 0),
    failed_users: Number(result?.failedUsers || 0),
    error_message: error ? errorMessage(error) : null,
    details: details || {}
  };
}

async function captureMarketHistory(input) {
  const options = normalizeCaptureOptions(input);
  const now = options.now;
  const startedAt = new Date();
  const runId = crypto.randomUUID();
  const config = getConfig();
  let loggingError = null;

  try {
    await createRun(config, {
      id: runId,
      trigger_type: options.trigger,
      status: "running",
      started_at: startedAt.toISOString(),
      details: { requestedAt: now.toISOString() }
    });
  } catch (error) {
    // Capturing market data remains available while an older schema is being upgraded.
    loggingError = errorMessage(error);
  }

  if (!isAfterUsMarketClose(now)) {
    const result = {
      runId,
      trigger: options.trigger,
      status: "skipped",
      skipped: true,
      reason: "US market has not reached the post-close capture window",
      loggingError
    };
    if (!loggingError) {
      result.loggingError = await safelyUpdateRun(config, runId, finalRunPatch(
        startedAt,
        result,
        "skipped",
        { reason: result.reason },
        null
      ));
    }
    return result;
  }

  try {
    const states = await requestSupabase(config, "/rest/v1/watchlist_states?select=user_id,items", {
      headers: { Range: "0-999" }
    });
    const today = marketDate(now);
    const sourceStates = Array.isArray(states) ? states : [];
    const resultCache = new Map();
    const failedSymbolSet = new Set();
    const userFailures = [];
    let processedUsers = 0;
    let savedEvents = 0;
    let skippedUsers = 0;
    let failedUsers = 0;

    for (const state of sourceStates) {
      const symbols = collectSymbols(state?.items);
      if (!state?.user_id || !symbols.length) {
        skippedUsers += 1;
        continue;
      }

      try {
        const key = symbols.join(",");
        if (!resultCache.has(key)) resultCache.set(key, getDailyMarketEvents(symbols));
        const snapshot = await resultCache.get(key);
        (snapshot.failedSymbols || []).forEach(function (symbol) { failedSymbolSet.add(symbol); });

        if (!snapshot.events.length && snapshot.failedSymbols?.length) {
          failedUsers += 1;
          continue;
        }

        // A market holiday or stale upstream quote must never be stamped as today.
        if (snapshot.date !== today || !snapshot.events.length) {
          skippedUsers += 1;
          continue;
        }

        const rows = snapshot.events.map(function (event) {
          return toHistoryRow(state.user_id, event, now);
        });
        await requestSupabase(config, "/rest/v1/market_event_history?on_conflict=user_id,market_date,symbol", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: rows
        });
        processedUsers += 1;
        savedEvents += rows.length;
      } catch (error) {
        failedUsers += 1;
        if (userFailures.length < 20) {
          userFailures.push({
            userId: state.user_id,
            error: errorMessage(error)
          });
        }
      }
    }

    const status = determineRunStatus(processedUsers, skippedUsers, failedUsers);
    const result = {
      runId,
      trigger: options.trigger,
      status,
      skipped: false,
      date: today,
      sourceUsers: sourceStates.length,
      processedUsers,
      savedEvents,
      skippedUsers,
      failedUsers,
      failedSymbols: Array.from(failedSymbolSet).sort(),
      loggingError
    };

    if (!loggingError) {
      result.loggingError = await safelyUpdateRun(config, runId, finalRunPatch(
        startedAt,
        result,
        status,
        {
          failedSymbols: result.failedSymbols,
          userFailures,
          reason: status === "skipped" ? "No user produced a current-market-date snapshot" : null
        },
        failedUsers > 0 ? failedUsers + " user capture(s) failed" : null
      ));
    }
    return result;
  } catch (error) {
    if (!loggingError) {
      loggingError = await safelyUpdateRun(config, runId, finalRunPatch(
        startedAt,
        null,
        "failed",
        {},
        error
      ));
    }
    error.runId = runId;
    error.loggingError = loggingError;
    throw error;
  }
}

async function getRecentCaptureRuns(limit) {
  const config = getConfig();
  const normalizedLimit = Math.min(50, Math.max(1, Number(limit) || 20));
  const columns = [
    "id",
    "trigger_type",
    "status",
    "market_date",
    "started_at",
    "finished_at",
    "duration_ms",
    "source_users",
    "processed_users",
    "saved_events",
    "skipped_users",
    "failed_users",
    "error_message",
    "details"
  ].join(",");
  const rows = await requestSupabase(
    config,
    "/rest/v1/" + RUNS_TABLE + "?select=" + columns + "&order=started_at.desc&limit=" + normalizedLimit
  );
  return Array.isArray(rows) ? rows : [];
}

module.exports = {
  captureMarketHistory,
  collectSymbols,
  determineRunStatus,
  getRecentCaptureRuns,
  normalizeCaptureOptions
};
