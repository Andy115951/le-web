const crypto = require("crypto");
const { getDailyMarketEvents, isAfterUsMarketClose, marketDate } = require("./daily-market-events");
const { NASDAQ_FOCUS_INSTRUMENTS, NASDAQ_UNIVERSE_AS_OF } = require("./nasdaq-universe");
const { getSupabaseConfig, requestSupabase } = require("./supabase-server");
const { persistUnifiedMarketEvents } = require("./unified-market-events");
const { captureRecentSecFilings, isSecEdgarConfigured } = require("./sec-edgar");
const { captureRecentFredObservations, isFredConfigured } = require("./fred-macro");

const RUNS_TABLE = "market_capture_runs";
const PUBLIC_HISTORY_TABLE = "nasdaq_market_event_history";
const INSTRUMENT_ROLES = new Map(NASDAQ_FOCUS_INSTRUMENTS.map(function (item) {
  return [item.symbol, item.role];
}));

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

function toPublicHistoryRow(event, now, universe) {
  const instruments = Array.isArray(universe?.instruments) ? universe.instruments : NASDAQ_FOCUS_INSTRUMENTS;
  const role = instruments.find(function (item) { return item.symbol === event.symbol; })?.role;
  return {
    market_date: event.date,
    symbol: event.symbol,
    display_name: event.name,
    instrument_role: role || INSTRUMENT_ROLES.get(event.symbol) || "component",
    universe_as_of: universe?.asOf || NASDAQ_UNIVERSE_AS_OF,
    change_percent: event.changePercent,
    benchmark_change_percent: event.benchmarkChangePercent,
    driver_type: event.driverType,
    confidence: event.confidence,
    summary: event.summary,
    reasons: Array.isArray(event.reasons) ? event.reasons : [],
    news: Array.isArray(event.news) ? event.news : [],
    event_time: event.eventTime || null,
    available_at: event.availableAt || event.capturedAt,
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

async function upsertRows(config, table, conflictColumns, rows) {
  if (!rows.length) return;
  await requestSupabase(config, "/rest/v1/" + table + "?on_conflict=" + conflictColumns, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: rows
  });
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
  const config = getSupabaseConfig();
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
    const today = marketDate(now);
    const publicSnapshot = await getDailyMarketEvents([]);
    const failedSymbolSet = new Set(publicSnapshot.failedSymbols || []);

    if (!publicSnapshot.events.length && publicSnapshot.failedSymbols?.length) {
      throw new Error("Public Nasdaq snapshot failed for all requested symbols");
    }

    // A market holiday or stale upstream quote must never be stamped as today.
    if (publicSnapshot.date !== today || !publicSnapshot.events.length) {
      const result = {
        runId,
        trigger: options.trigger,
        status: "skipped",
        skipped: true,
        date: today,
        reason: "Public Nasdaq snapshot is not for the current US market date",
        publicSavedEvents: 0,
        savedEvents: 0,
        failedSymbols: Array.from(failedSymbolSet).sort(),
        loggingError
      };
      if (!loggingError) {
        result.loggingError = await safelyUpdateRun(config, runId, finalRunPatch(
          startedAt,
          result,
          "skipped",
          { reason: result.reason, failedSymbols: result.failedSymbols },
          null
        ));
      }
      return result;
    }

    const publicRows = publicSnapshot.events.map(function (event) {
      return toPublicHistoryRow(event, now, publicSnapshot.universe);
    });
    await upsertRows(config, PUBLIC_HISTORY_TABLE, "market_date,symbol", publicRows);
    const publicSavedEvents = publicRows.length;
    const unifiedResult = await persistUnifiedMarketEvents(config, publicSnapshot.events, now);
    let secFilingResult = {
      status: isSecEdgarConfigured() ? "pending" : "disabled",
      eventsWritten: 0,
      sourcesWritten: 0,
      fetchedCompanies: [],
      skippedSymbols: [],
      error: null
    };
    if (isSecEdgarConfigured()) {
      try {
        const secSymbols = (publicSnapshot.universe?.instruments || NASDAQ_FOCUS_INSTRUMENTS)
          .map(function (instrument) { return instrument.symbol; });
        const captured = await captureRecentSecFilings(config, secSymbols, { now });
        secFilingResult = { status: "succeeded", error: null, ...captured };
      } catch (error) {
        // SEC outages and configuration issues must not discard the completed market close snapshot.
        secFilingResult = { ...secFilingResult, status: "failed", error: errorMessage(error) };
      }
    }
    let fredMacroResult = {
      status: isFredConfigured() ? "pending" : "disabled",
      eventsWritten: 0,
      sourcesWritten: 0,
      seriesIds: [],
      observations: [],
      error: null
    };
    if (isFredConfigured()) {
      try {
        const captured = await captureRecentFredObservations(config, { now });
        fredMacroResult = { status: "succeeded", error: null, ...captured };
      } catch (error) {
        // Macro data is additive research context and must not discard a completed market snapshot.
        fredMacroResult = { ...fredMacroResult, status: "failed", error: errorMessage(error) };
      }
    }

    const states = await requestSupabase(config, "/rest/v1/watchlist_states?select=user_id,items", {
      headers: { Range: "0-999" }
    });
    const sourceStates = Array.isArray(states) ? states : [];
    const resultCache = new Map();
    const userFailures = [];
    let processedUsers = 0;
    let personalSavedEvents = 0;
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
        await upsertRows(config, "market_event_history", "user_id,market_date,symbol", rows);
        processedUsers += 1;
        personalSavedEvents += rows.length;
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

    const status = determineRunStatus(1 + processedUsers, skippedUsers, failedUsers);
    const savedEvents = publicSavedEvents + personalSavedEvents;
    const result = {
      runId,
      trigger: options.trigger,
      status,
      skipped: false,
      date: today,
      sourceUsers: sourceStates.length,
      processedUsers,
      savedEvents,
      publicSavedEvents,
      unifiedSavedEvents: unifiedResult.eventsWritten,
      unifiedSavedSources: unifiedResult.sourcesWritten,
      secFilingStatus: secFilingResult.status,
      secFilingEvents: secFilingResult.eventsWritten,
      secFilingSources: secFilingResult.sourcesWritten,
      fredMacroStatus: fredMacroResult.status,
      fredMacroEvents: fredMacroResult.eventsWritten,
      fredMacroSources: fredMacroResult.sourcesWritten,
      personalSavedEvents,
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
          publicSavedEvents,
          unifiedSavedEvents: result.unifiedSavedEvents,
          unifiedSavedSources: result.unifiedSavedSources,
          secFilingStatus: secFilingResult.status,
          secFilingEvents: secFilingResult.eventsWritten,
          secFilingSources: secFilingResult.sourcesWritten,
          secFilingFetchedCompanies: secFilingResult.fetchedCompanies,
          secFilingSkippedSymbols: secFilingResult.skippedSymbols,
          secFilingError: secFilingResult.error,
          fredMacroStatus: fredMacroResult.status,
          fredMacroEvents: fredMacroResult.eventsWritten,
          fredMacroSources: fredMacroResult.sourcesWritten,
          fredMacroSeriesIds: fredMacroResult.seriesIds,
          fredMacroObservationCount: fredMacroResult.observations.length,
          fredMacroError: fredMacroResult.error,
          personalSavedEvents,
          publicUniverseAsOf: publicSnapshot.universe?.asOf || NASDAQ_UNIVERSE_AS_OF,
          publicUniverseSource: publicSnapshot.universe?.source || null
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

function normalizeHistoryDays(days) {
  const value = Number(days) || 30;
  return [30, 90, 180].includes(value) ? value : 30;
}

async function getNasdaqMarketHistory(days) {
  const config = getSupabaseConfig();
  const normalizedDays = normalizeHistoryDays(days);
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - normalizedDays + 1);
  const startDate = start.toISOString().slice(0, 10);
  const columns = [
    "market_date",
    "symbol",
    "display_name",
    "instrument_role",
    "universe_as_of",
    "change_percent",
    "benchmark_change_percent",
    "driver_type",
    "confidence",
    "summary",
    "reasons",
    "news",
    "event_time",
    "available_at",
    "captured_at"
  ].join(",");
  const rows = await requestSupabase(
    config,
    "/rest/v1/" + PUBLIC_HISTORY_TABLE
      + "?select=" + columns
      + "&market_date=gte." + startDate
      + "&order=market_date.desc,symbol.asc"
      + "&limit=" + (normalizedDays * NASDAQ_FOCUS_INSTRUMENTS.length)
  );
  return Array.isArray(rows) ? rows : [];
}

async function getRecentCaptureRuns(limit) {
  const config = getSupabaseConfig();
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
  getNasdaqMarketHistory,
  getRecentCaptureRuns,
  normalizeCaptureOptions,
  normalizeHistoryDays,
  toHistoryRow,
  toPublicHistoryRow
};
