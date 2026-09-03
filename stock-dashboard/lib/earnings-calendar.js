const crypto = require("crypto");
const { canonicalizeSourceUrl, sourceFingerprint } = require("./unified-market-events");
const { getSupabaseConfig, requestSupabase } = require("./supabase-server");

const EARNINGS_CALENDAR_VERSION = "earnings-calendar-v1";
const ALLOWED_SESSIONS = new Set(["before_market", "after_market", "during_market", "unknown"]);
const ALLOWED_STATUSES = new Set(["scheduled", "reported", "cancelled"]);

function normalizeMarketDate(value, field = "market date") {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date + "T12:00:00.000Z").toISOString().slice(0, 10) !== date) {
    throw new Error("Invalid earnings " + field);
  }
  return date;
}

function normalizeSymbol(value) {
  const symbol = String(value || "").trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) throw new Error("Invalid earnings symbol");
  return symbol;
}

function normalizeTimestamp(value, field) {
  if (value === null || value === undefined || value === "") return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) throw new Error("Invalid earnings " + field);
  return new Date(timestamp).toISOString();
}

function normalizeSession(value) {
  const session = String(value || "unknown").trim().toLowerCase();
  if (!ALLOWED_SESSIONS.has(session)) throw new Error("Invalid earnings session");
  return session;
}

function normalizeStatus(value) {
  const status = String(value || "scheduled").trim().toLowerCase();
  if (!ALLOWED_STATUSES.has(status)) throw new Error("Invalid earnings status");
  return status;
}

function exactTimestampOrNull(value) {
  const timestamp = new Date(value || "").getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function nullableNumber(value, field) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error("Invalid earnings " + field);
  return number;
}

function stableEarningsEventKey(symbol, sourceUrl) {
  return "earnings:" + symbol + ":" + crypto.createHash("sha256").update(sourceUrl).digest("hex").slice(0, 24);
}

function normalizeEarningsCandidate(input, now = new Date()) {
  const entry = input && typeof input === "object" ? input : {};
  const symbol = normalizeSymbol(entry.symbol);
  const marketDate = normalizeMarketDate(entry.marketDate);
  const sourceUrl = canonicalizeSourceUrl(entry.sourceUrl);
  const provider = String(entry.provider || "Company Investor Relations").trim();
  const sourceTitle = String(entry.sourceTitle || symbol + " earnings calendar").trim();
  if (!provider || !sourceTitle) throw new Error("Missing earnings source metadata");
  const capturedAt = normalizeTimestamp(entry.capturedAt, "captured time") || now.toISOString();
  const sourcePublishedAt = normalizeTimestamp(entry.sourcePublishedAt, "source published time");
  const scheduledAt = normalizeTimestamp(entry.scheduledAt, "scheduled time");
  const fiscalPeriod = entry.fiscalPeriod === null || entry.fiscalPeriod === undefined || entry.fiscalPeriod === ""
    ? null
    : String(entry.fiscalPeriod).trim();
  if (fiscalPeriod && fiscalPeriod.length > 64) throw new Error("Invalid earnings fiscal period");
  const status = normalizeStatus(entry.status);
  const session = normalizeSession(entry.session);
  const normalized = {
    symbol,
    marketDate,
    scheduledAt,
    availableAt: sourcePublishedAt || capturedAt,
    capturedAt,
    session,
    status,
    fiscalPeriod,
    epsEstimate: nullableNumber(entry.epsEstimate, "EPS estimate"),
    epsActual: nullableNumber(entry.epsActual, "EPS actual"),
    revenueEstimate: nullableNumber(entry.revenueEstimate, "revenue estimate"),
    revenueActual: nullableNumber(entry.revenueActual, "revenue actual"),
    sourceUrl,
    provider,
    sourceTitle,
    sourcePublishedAt
  };
  return { ...normalized, eventKey: stableEarningsEventKey(symbol, sourceUrl) };
}

function buildEarningsImportRecords(input, now = new Date()) {
  const candidates = Array.isArray(input)
    ? input
    : Array.isArray(input?.events)
      ? input.events
      : [input];
  const byKey = new Map();
  candidates.forEach(function (candidate) {
    const normalized = normalizeEarningsCandidate(candidate, now);
    if (byKey.has(normalized.eventKey)) throw new Error("Duplicate earnings source event: " + normalized.symbol);
    byKey.set(normalized.eventKey, normalized);
  });
  const events = Array.from(byKey.values());
  return {
    version: EARNINGS_CALENDAR_VERSION,
    events,
    sources: Array.from(new Map(events.map(function (event) {
      return [event.sourceUrl, {
        source_kind: "company_ir",
        provider: event.provider,
        title: event.sourceTitle,
        canonical_url: event.sourceUrl,
        content_fingerprint: sourceFingerprint(event.sourceUrl),
        published_at: event.sourcePublishedAt,
        available_at: event.availableAt,
        captured_at: event.capturedAt,
        metadata: { sourceRole: "earnings_calendar" }
      }];
    })).values())
  };
}

function buildEarningsImportPreview(records) {
  const events = Array.isArray(records?.events) ? records.events : [];
  const statuses = events.reduce(function (counts, event) {
    const status = normalizeStatus(event?.status);
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
  const featureEligibleCount = events.filter(function (event) {
    return event.status === "reported" && Boolean(exactTimestampOrNull(event.sourcePublishedAt));
  }).length;
  return {
    version: EARNINGS_CALENDAR_VERSION,
    candidateCount: events.length,
    sourceCount: Array.isArray(records?.sources) ? records.sources.length : 0,
    symbols: Array.from(new Set(events.map(function (event) { return event.symbol; }))).sort(),
    statuses,
    featureEligibleCount,
    calendarOnlyCount: Math.max(0, events.length - featureEligibleCount),
    requiresExplicitApproval: true
  };
}

async function upsertReturning(config, table, conflictColumns, rows, client = requestSupabase) {
  if (!rows.length) return [];
  const persisted = [];
  for (let offset = 0; offset < rows.length; offset += 250) {
    const page = await client(config, "/rest/v1/" + table + "?on_conflict=" + conflictColumns, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: rows.slice(offset, offset + 250)
    });
    if (Array.isArray(page)) persisted.push(...page);
  }
  return persisted;
}

async function persistEarningsImport(config, records, client = requestSupabase) {
  const events = Array.isArray(records?.events) ? records.events : [];
  if (!events.length) return { eventsWritten: 0, sourcesWritten: 0 };
  const symbols = Array.from(new Set(events.map(function (event) { return event.symbol; })));
  const instruments = await client(config, "/rest/v1/instruments?select=id,symbol&symbol=in.(" + symbols.map(encodeURIComponent).join(",") + ")");
  const instrumentBySymbol = new Map((Array.isArray(instruments) ? instruments : []).map(function (instrument) {
    return [instrument.symbol, instrument.id];
  }));
  const missingSymbols = symbols.filter(function (symbol) { return !instrumentBySymbol.has(symbol); });
  if (missingSymbols.length) throw new Error("Missing registered instruments: " + missingSymbols.join(", "));
  const sources = await upsertReturning(config, "sources", "canonical_url", records.sources || [], client);
  const sourceByUrl = new Map(sources.map(function (source) { return [source.canonical_url, source.id]; }));
  const rows = events.map(function (event) {
    return {
      event_key: event.eventKey,
      instrument_id: instrumentBySymbol.get(event.symbol),
      market_date: event.marketDate,
      scheduled_at: event.scheduledAt,
      available_at: event.availableAt,
      captured_at: event.capturedAt,
      session: event.session,
      event_status: event.status,
      fiscal_period: event.fiscalPeriod,
      eps_estimate: event.epsEstimate,
      eps_actual: event.epsActual,
      revenue_estimate: event.revenueEstimate,
      revenue_actual: event.revenueActual,
      source_id: sourceByUrl.get(event.sourceUrl),
      collector_version: EARNINGS_CALENDAR_VERSION,
      metadata: { sourceRole: "earnings_calendar" },
      updated_at: event.capturedAt
    };
  });
  if (rows.some(function (row) { return !row.source_id; })) throw new Error("Failed to persist earnings source");
  const written = await upsertReturning(config, "earnings_events", "event_key", rows, client);
  return { eventsWritten: written.length, sourcesWritten: sources.length };
}

function normalizeLimit(value, fallback = 100) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? Math.min(number, 250) : fallback;
}

function normalizeStatusFilter(value) {
  if (value === null || value === undefined || value === "") return null;
  return normalizeStatus(value);
}

async function getEarningsEvents(options = {}, config, client = requestSupabase) {
  const startDate = normalizeMarketDate(options.startDate || options.start || new Date().toISOString().slice(0, 10), "start date");
  const endDate = normalizeMarketDate(options.endDate || options.end || startDate, "end date");
  const status = normalizeStatusFilter(options.status);
  if (startDate > endDate) throw new Error("Invalid earnings date range");
  const resolvedConfig = config || getSupabaseConfig();
  const rows = await client(resolvedConfig,
    "/rest/v1/earnings_events?select=event_key,market_date,scheduled_at,available_at,session,event_status,fiscal_period,eps_estimate,eps_actual,revenue_estimate,revenue_actual,collector_version,instruments(symbol,display_name),sources(provider,title,canonical_url,published_at)"
      + "&market_date=gte." + startDate
      + "&market_date=lte." + endDate
      + (status ? "&event_status=eq." + encodeURIComponent(status) : "")
      + "&order=market_date.asc,scheduled_at.asc.nullslast,event_key.asc&limit=" + normalizeLimit(options.limit)
  );
  return {
    startDate,
    endDate,
    status,
    events: (Array.isArray(rows) ? rows : []).map(function (row) {
      return {
        eventKey: row.event_key,
        marketDate: row.market_date,
        scheduledAt: row.scheduled_at,
        availableAt: row.available_at,
        session: row.session,
        status: row.event_status,
        fiscalPeriod: row.fiscal_period,
        epsEstimate: nullableNumber(row.eps_estimate, "EPS estimate"),
        epsActual: nullableNumber(row.eps_actual, "EPS actual"),
        revenueEstimate: nullableNumber(row.revenue_estimate, "revenue estimate"),
        revenueActual: nullableNumber(row.revenue_actual, "revenue actual"),
        collectorVersion: row.collector_version,
        symbol: row.instruments?.symbol || null,
        displayName: row.instruments?.display_name || null,
        source: row.sources ? {
          provider: row.sources.provider,
          title: row.sources.title,
          canonicalUrl: row.sources.canonical_url,
          publishedAt: row.sources.published_at
        } : null
      };
    })
  };
}

// Calendar ingestion and historical research have different time contracts.
// A candidate may be safely shown on a calendar with an unknown release time,
// but it must not enter a dated feature row unless the cited official source
// provides an exact publication timestamp. In particular, captured_at is not
// an acceptable substitute: it records when our system saw the page, not when
// the market could have known the fact.
function buildReportedEarningsFeatureEvent(event) {
  const status = String(event?.status || event?.event_status || "").trim().toLowerCase();
  const symbol = String(event?.symbol || "").trim().toUpperCase();
  const marketDate = String(event?.marketDate || event?.market_date || "").trim();
  const sourcePublishedAt = exactTimestampOrNull(event?.source?.publishedAt || event?.source_published_at || event?.sourcePublishedAt);
  if (status !== "reported" || !symbol || !marketDate || !sourcePublishedAt) return null;
  const sourceUrl = String(event?.source?.canonicalUrl || event?.source?.canonical_url || event?.sourceUrl || "").trim();
  return {
    event_key: "earnings_calendar:" + String(event?.eventKey || event?.event_key || stableEarningsEventKey(symbol, sourceUrl || symbol)),
    market_date: marketDate,
    available_at: sourcePublishedAt,
    event_type: "earnings_reported",
    impact_level: "unknown",
    tickers: [symbol]
  };
}

async function getReportedEarningsFeatureEvents(options = {}, config = getSupabaseConfig(), client = requestSupabase) {
  // Keep scheduled and cancelled calendar records out of the feature query itself.
  // The mapper below retains the status check as a second boundary for malformed rows.
  const calendar = await getEarningsEvents({ ...options, status: "reported" }, config, client);
  return calendar.events.map(buildReportedEarningsFeatureEvent).filter(Boolean);
}

module.exports = {
  ALLOWED_SESSIONS,
  ALLOWED_STATUSES,
  EARNINGS_CALENDAR_VERSION,
  buildEarningsImportRecords,
  buildEarningsImportPreview,
  buildReportedEarningsFeatureEvent,
  getEarningsEvents,
  getReportedEarningsFeatureEvents,
  normalizeEarningsCandidate,
  normalizeMarketDate,
  normalizeStatusFilter,
  persistEarningsImport,
  stableEarningsEventKey
};
